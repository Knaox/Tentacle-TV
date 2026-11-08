// Sonde GPU sans root : IOReport (énergie GPU/CPU/DRAM, résidence des états GPU).
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/time.h>
typedef struct __IOReportSubscriptionCF *IOReportSubscriptionRef;
extern CFDictionaryRef IOReportCopyChannelsInGroup(CFStringRef, CFStringRef, uint64_t, uint64_t, uint64_t);
extern void IOReportMergeChannels(CFDictionaryRef, CFDictionaryRef, CFTypeRef);
extern IOReportSubscriptionRef IOReportCreateSubscription(void*, CFMutableDictionaryRef, CFMutableDictionaryRef*, uint64_t, CFTypeRef);
extern CFDictionaryRef IOReportCreateSamples(IOReportSubscriptionRef, CFMutableDictionaryRef, CFTypeRef);
extern CFDictionaryRef IOReportCreateSamplesDelta(CFDictionaryRef, CFDictionaryRef, CFTypeRef);
extern CFStringRef IOReportChannelGetGroup(CFDictionaryRef);
extern CFStringRef IOReportChannelGetSubGroup(CFDictionaryRef);
extern CFStringRef IOReportChannelGetChannelName(CFDictionaryRef);
extern CFStringRef IOReportChannelGetUnitLabel(CFDictionaryRef);
extern int64_t IOReportSimpleGetIntegerValue(CFDictionaryRef, int32_t);
extern int32_t IOReportStateGetCount(CFDictionaryRef);
extern CFStringRef IOReportStateGetNameForIndex(CFDictionaryRef, int32_t);
extern int64_t IOReportStateGetResidency(CFDictionaryRef, int32_t);
static int eq(CFStringRef s, const char *c){ if(!s) return 0; char b[128]; if(!CFStringGetCString(s,b,sizeof b,kCFStringEncodingUTF8)) return 0; return strcmp(b,c)==0; }
static double to_j(int64_t v, CFStringRef unit){ char u[16]={0}; if(unit) CFStringGetCString(unit,u,sizeof u,kCFStringEncodingUTF8);
  if(!strcmp(u,"nJ")) return v/1e9; if(!strcmp(u,"uJ")) return v/1e6; if(!strcmp(u,"mJ")) return v/1e3; return v/1e3; }
static double now(){ struct timeval t; gettimeofday(&t,0); return t.tv_sec+t.tv_usec/1e6; }
int main(int argc,char**argv){
  int ms = argc>1?atoi(argv[1]):1000, n = argc>2?atoi(argv[2]):10;
  CFDictionaryRef e = IOReportCopyChannelsInGroup(CFSTR("Energy Model"), NULL,0,0,0);
  CFDictionaryRef g = IOReportCopyChannelsInGroup(CFSTR("GPU Stats"), CFSTR("GPU Performance States"),0,0,0);
  IOReportMergeChannels(e,g,NULL);
  CFMutableDictionaryRef ch = CFDictionaryCreateMutableCopy(kCFAllocatorDefault, CFDictionaryGetCount(e), e);
  CFMutableDictionaryRef sub = NULL;
  IOReportSubscriptionRef s = IOReportCreateSubscription(NULL, ch, &sub, 0, NULL);
  if(!s){ fprintf(stderr,"abonnement IOReport refusé\n"); return 1; }
  CFDictionaryRef prev = IOReportCreateSamples(s, sub, NULL); double tp=now();
  printf("t\tgpu_mW\tgpu_actif_pct\tcpu_mW\tdram_mW\n");
  for(int i=0;i<n;i++){
    usleep(ms*1000);
    CFDictionaryRef cur = IOReportCreateSamples(s, sub, NULL); double tc=now(), dt=tc-tp;
    CFDictionaryRef d = IOReportCreateSamplesDelta(prev, cur, NULL);
    CFArrayRef arr = CFDictionaryGetValue(d, CFSTR("IOReportChannels"));
    double gpuJ=0,cpuJ=0,dramJ=0; int64_t act=0,tot=0;
    for(CFIndex k=0;k<CFArrayGetCount(arr);k++){
      CFDictionaryRef c = CFArrayGetValueAtIndex(arr,k);
      CFStringRef grp=IOReportChannelGetGroup(c), name=IOReportChannelGetChannelName(c);
      if(eq(grp,"Energy Model")){
        double j = to_j(IOReportSimpleGetIntegerValue(c,0), IOReportChannelGetUnitLabel(c));
        if(eq(name,"GPU Energy")) gpuJ+=j;
        else if(eq(name,"CPU Energy")) cpuJ+=j;
        else if(eq(name,"DRAM")) dramJ+=j;
      } else if(eq(grp,"GPU Stats") && eq(name,"GPUPH")){
        int32_t nc = IOReportStateGetCount(c);
        for(int32_t x=0;x<nc;x++){ int64_t r=IOReportStateGetResidency(c,x); tot+=r;
          CFStringRef sn=IOReportStateGetNameForIndex(c,x); if(!eq(sn,"OFF") && !eq(sn,"IDLE") && !eq(sn,"DOWN")) act+=r; }
      }
    }
    printf("%.0f\t%.1f\t%.1f\t%.1f\t%.1f\n", tc, gpuJ/dt*1000, tot? 100.0*act/tot:0, cpuJ/dt*1000, dramJ/dt*1000);
    fflush(stdout);
    CFRelease(d); CFRelease(prev); prev=cur; tp=tc;
  }
  return 0;
}
