"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WheelPickerProps {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  infinite?: boolean;
}

export function WheelPicker({ items, value, onChange, className, infinite = false }: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const itemHeight = 44;
  const visibleItems = 5;
  const repeatCount = infinite ? 100 : 1;
  const totalItems = items.length * repeatCount;
  const middleOffset = Math.floor(repeatCount / 2) * items.length;
  const selectedIndex = Math.max(items.indexOf(value), 0);

  useEffect(() => {
    if (containerRef.current && !isScrolling) {
      const targetIndex = middleOffset + selectedIndex;
      containerRef.current.scrollTop = targetIndex * itemHeight;
    }
  }, [selectedIndex, isScrolling, middleOffset]);

  const handleScrollEnd = () => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const rawIndex = Math.round(scrollTop / itemHeight);
    const itemIndex = ((rawIndex % items.length) + items.length) % items.length;
    const actualItem = items[itemIndex];

    if (actualItem !== value) {
      onChange(actualItem);
    }

    if (infinite) {
      const targetIndex = middleOffset + itemIndex;
      if (Math.abs(rawIndex - targetIndex) > items.length) {
        containerRef.current.scrollTop = targetIndex * itemHeight;
      }
    }

    containerRef.current.scrollTo({
      top: Math.round(scrollTop / itemHeight) * itemHeight,
      behavior: "smooth",
    });

    setTimeout(() => setIsScrolling(false), 100);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;

    setIsScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(handleScrollEnd, 150);
  };

  const allItems = infinite
    ? Array.from({ length: totalItems }, (_, index) => items[index % items.length])
    : items;

  return (
    <div className={cn("relative", className)} style={{ height: itemHeight * visibleItems }}>
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-11 -translate-y-1/2 border-y border-[#38bdf8]/35 bg-[#38bdf8]/5" />

      <div
        ref={containerRef}
        className="scrollbar-hide h-full snap-y snap-mandatory overflow-y-auto"
        onScroll={handleScroll}
        onTouchEnd={handleScrollEnd}
        onMouseUp={handleScrollEnd}
        style={{
          paddingTop: itemHeight * 2,
          paddingBottom: itemHeight * 2,
        }}
      >
        {allItems.map((item, index) => {
          const actualIndex = infinite ? index - middleOffset : index;
          const distance = Math.abs(actualIndex - selectedIndex);
          const isSelected = item === value && distance < items.length / 2;

          return (
            <div
              key={`${item}-${index}`}
              className={cn(
                "flex h-11 cursor-pointer snap-center items-center justify-center transition-all duration-150",
                isSelected
                  ? "text-lg font-semibold text-white"
                  : distance === 1
                    ? "text-base text-[#b8c7da]"
                    : "text-sm text-[#8fa3b8]/60"
              )}
              onClick={() => {
                onChange(item);
                if (containerRef.current) {
                  containerRef.current.scrollTo({
                    top: index * itemHeight,
                    behavior: "smooth",
                  });
                }
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}
