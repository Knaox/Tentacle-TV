import { useState, type ImgHTMLAttributes } from "react";

interface FadeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  duration?: number;
}

export function FadeImage({ duration = 0.3, style, onLoad, ...props }: FadeImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      {...props}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: `opacity ${duration}s ease`,
      }}
    />
  );
}
