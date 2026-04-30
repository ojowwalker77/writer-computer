import { useCallback, type HTMLAttributes, type ReactNode, type Ref, type UIEvent } from "react";
import { useScrollFade } from "@/hooks/use-scroll-fade";

interface ScrollFadeProps extends Omit<HTMLAttributes<HTMLDivElement>, "style"> {
  axis?: "vertical" | "horizontal";
  fadeSize?: string;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export function ScrollFade({
  axis = "vertical",
  fadeSize = "24px",
  className,
  onScroll: onScrollProp,
  ref,
  children,
  ...rest
}: ScrollFadeProps) {
  const { setRef, scrolledStart, scrolledEnd, onScroll } = useScrollFade(axis);
  const direction = axis === "vertical" ? "bottom" : "right";
  const maskImage = `linear-gradient(to ${direction}, ${
    scrolledStart ? `transparent, black ${fadeSize},` : "black,"
  } ${scrolledEnd ? `black calc(100% - ${fadeSize}), transparent` : "black"})`;

  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      setRef(el);
      if (typeof ref === "function") {
        ref(el);
      } else if (ref) {
        (ref as { current: HTMLDivElement | null }).current = el;
      }
    },
    [setRef, ref],
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      onScroll();
      onScrollProp?.(event);
    },
    [onScroll, onScrollProp],
  );

  return (
    <div
      {...rest}
      ref={mergedRef}
      onScroll={handleScroll}
      className={className}
      style={{ maskImage, WebkitMaskImage: maskImage }}
    >
      {children}
    </div>
  );
}
