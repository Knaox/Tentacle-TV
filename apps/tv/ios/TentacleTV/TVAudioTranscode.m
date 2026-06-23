//
//  TVAudioTranscode.m  (tvOS / Apple TV) — transcode audio ON-DEVICE du lecteur
//  « façon Infuse ». Extrait VERBATIM de TVLocalRemux.m (refactor 1:1, unity build).
//  #importé par TVLocalRemux.m → même unité de traduction.
//

#import "TVCommon.h"

// ===== Transcode audio ON-DEVICE (DTS-HD MA / TrueHD / FLAC → EAC3) =====
// AVPlayer ne décode que AAC/AC3/EAC3/ALAC → on décode la source + réencode EAC3 (≤5.1).
// La VIDÉO reste en COPIE (Direct Play, badge DV). Atmos/lossless perdus (limite Apple).

// Prépare décodeur source + encodeur EAC3 + resampler + FIFO. os->codecpar ← encodeur.
static int TVAudioSetup(AVCodecParameters *ip, AVStream *os,
                        AVCodecContext **padec, AVCodecContext **paenc,
                        SwrContext **paswr, AVAudioFifo **pafifo) {
  const AVCodec *dec = avcodec_find_decoder(ip->codec_id);
  if (!dec) { TVLOG("audio: pas de décodeur id=%d", ip->codec_id); return -1; }
  AVCodecContext *adec = avcodec_alloc_context3(dec);
  if (!adec || avcodec_parameters_to_context(adec, ip) < 0 || avcodec_open2(adec, dec, NULL) < 0) {
    TVLOG("audio: décodeur open FAIL"); if (adec) avcodec_free_context(&adec); return -1; }
  const AVCodec *enc = avcodec_find_encoder(AV_CODEC_ID_EAC3);
  if (!enc) { TVLOG("audio: pas d'encodeur EAC3"); avcodec_free_context(&adec); return -1; }
  AVCodecContext *aenc = avcodec_alloc_context3(enc);
  // EAC3 ≤ 5.1 : mono/stéréo conservés ; multicanal → downmix 5.1 (swresample fait le downmix).
  if (adec->ch_layout.nb_channels <= 2) av_channel_layout_copy(&aenc->ch_layout, &adec->ch_layout);
  else { AVChannelLayout l = AV_CHANNEL_LAYOUT_5POINT1; av_channel_layout_copy(&aenc->ch_layout, &l); }
  aenc->sample_rate = 48000;
  aenc->sample_fmt  = AV_SAMPLE_FMT_FLTP;   // format de l'encodeur AC3/EAC3
  aenc->bit_rate    = 640000;
  aenc->time_base   = (AVRational){1, aenc->sample_rate};
  if (avcodec_open2(aenc, enc, NULL) < 0) { TVLOG("audio: encodeur EAC3 open FAIL"); avcodec_free_context(&adec); avcodec_free_context(&aenc); return -1; }
  avcodec_parameters_from_context(os->codecpar, aenc);
  os->codecpar->codec_tag = 0;
  os->time_base = aenc->time_base;
  SwrContext *swr = NULL;
  if (swr_alloc_set_opts2(&swr, &aenc->ch_layout, aenc->sample_fmt, aenc->sample_rate,
                                &adec->ch_layout, adec->sample_fmt, adec->sample_rate, 0, NULL) < 0
      || swr_init(swr) < 0) { TVLOG("audio: swr init FAIL"); avcodec_free_context(&adec); avcodec_free_context(&aenc); if (swr) swr_free(&swr); return -1; }
  AVAudioFifo *fifo = av_audio_fifo_alloc(aenc->sample_fmt, aenc->ch_layout.nb_channels, 4096);
  *padec = adec; *paenc = aenc; *paswr = swr; *pafifo = fifo;
  TVLOG("audio: transcode id=%d %dch %dHz → EAC3 %dch 48k", ip->codec_id,
        adec->ch_layout.nb_channels, adec->sample_rate, aenc->ch_layout.nb_channels);
  return 0;
}

// Encode les frames PLEINES du FIFO en EAC3 + écrit. flush=1 → vide le reste + draine l'encodeur.
static void TVAudioEncodeFifo(AVFormatContext *oc, AVCodecContext *aenc, AVAudioFifo *fifo,
                              int outIdx, int64_t *nextPts, int flush) {
  int fs = aenc->frame_size > 0 ? aenc->frame_size : 1536;
  AVPacket *op = av_packet_alloc();
  while (av_audio_fifo_size(fifo) >= fs || (flush && av_audio_fifo_size(fifo) > 0)) {
    int n = FFMIN(av_audio_fifo_size(fifo), fs);
    AVFrame *f = av_frame_alloc();
    f->nb_samples = n; f->format = aenc->sample_fmt; f->sample_rate = aenc->sample_rate;
    av_channel_layout_copy(&f->ch_layout, &aenc->ch_layout);
    if (av_frame_get_buffer(f, 0) < 0) { av_frame_free(&f); break; }
    av_audio_fifo_read(fifo, (void **)f->data, n);
    f->pts = *nextPts; *nextPts += n;
    if (avcodec_send_frame(aenc, f) == 0)
      while (avcodec_receive_packet(aenc, op) == 0) {
        op->stream_index = outIdx;
        av_packet_rescale_ts(op, aenc->time_base, oc->streams[outIdx]->time_base);
        av_interleaved_write_frame(oc, op); av_packet_unref(op);
      }
    av_frame_free(&f);
  }
  if (flush) {
    avcodec_send_frame(aenc, NULL);
    while (avcodec_receive_packet(aenc, op) == 0) {
      op->stream_index = outIdx;
      av_packet_rescale_ts(op, aenc->time_base, oc->streams[outIdx]->time_base);
      av_interleaved_write_frame(oc, op); av_packet_unref(op);
    }
  }
  av_packet_free(&op);
}

// Décode un paquet audio (pkt=NULL → flush) → resample → FIFO → encode EAC3.
static void TVAudioTranscode(AVFormatContext *oc, AVCodecContext *adec, AVCodecContext *aenc,
                             SwrContext *swr, AVAudioFifo *fifo, int outIdx, int64_t *nextPts, AVPacket *pkt) {
  avcodec_send_packet(adec, pkt);
  AVFrame *df = av_frame_alloc();
  while (avcodec_receive_frame(adec, df) == 0) {
    int out_n = swr_get_out_samples(swr, df->nb_samples);
    if (out_n > 0) {
      uint8_t **conv = NULL;
      if (av_samples_alloc_array_and_samples(&conv, NULL, aenc->ch_layout.nb_channels, out_n, aenc->sample_fmt, 0) >= 0) {
        int got = swr_convert(swr, conv, out_n, (const uint8_t **)df->extended_data, df->nb_samples);
        if (got > 0) av_audio_fifo_write(fifo, (void **)conv, got);
        if (conv) { av_freep(&conv[0]); av_freep(&conv); }
      }
    }
    av_frame_unref(df);
  }
  av_frame_free(&df);
  TVAudioEncodeFifo(oc, aenc, fifo, outIdx, nextPts, pkt == NULL);
}

// État de transcode audio PAR flux de sortie (dec==NULL → la piste est en COPIE).
typedef struct { AVCodecContext *dec, *enc; SwrContext *swr; AVAudioFifo *fifo; int64_t nextPts; } TVAud;
