import { useEffect, useState } from "react";
import SendButton from "./SendButton";

type AnimatedInputProps = {
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => void;
  placeholder: string;
  disabled: boolean;
  isLoading: boolean;
  inputValue: string;
  onSubmit: (e: React.FormEvent) => void;
  isCompact?: boolean;
};

export default function AnimatedInput({
  value,
  onChange,
  placeholder,
  disabled,
  isLoading,
  inputValue,
  onSubmit,
  isCompact = false,
}: AnimatedInputProps) {
  const [isMultiline, setIsMultiline] = useState(false);

  useEffect(() => {
    if (value === "") {
      const textarea = document.querySelector(
        `textarea${isCompact ? ".compact" : ".main"}`
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = isCompact ? "auto" : "40px";
      }
      setIsMultiline(false);
    }
  }, [value, isCompact]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  if (isCompact) {
    return (
      <form onSubmit={onSubmit} className="p-4 border-t border-gray-200">
        <div
          className={`${isCompact ? "" : "search-animated-border"} rounded-md`}
        >
          <div className="search-inner">
            <div className="relative bg-white/90 backdrop-blur-sm rounded-md">
              <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full px-3 py-2 pr-16 bg-transparent border-none rounded-md focus:outline-none focus:ring-0 disabled:opacity-50 placeholder-gray-500"
                disabled={disabled}
              />
              <SendButton
                isLoading={isLoading}
                disabled={disabled || !inputValue.trim()}
                isCompact={true}
              />
            </div>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-4/5 max-w-[1550px]">
      <div className="search-animated-border rounded-lg">
        <div className="search-inner">
          <div className="relative bg-white/90 backdrop-blur-sm rounded-lg flex">
            <textarea
              onKeyDown={onKeyDown}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              className="main w-full px-4 pr-20 bg-transparent border-none rounded-lg focus:outline-none focus:ring-0 disabled:opacity-50 text-base placeholder-gray-500 resize-none overflow-hidden max-h-[200px]"
              disabled={disabled}
              rows={1}
              style={{
                height: "40px",
                lineHeight: "24px",
                paddingTop: "11px",
                paddingBottom: "8px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "40px";
                const newHeight = Math.max(
                  40,
                  Math.min(target.scrollHeight, 200)
                );
                target.style.height = newHeight + "px";
                setIsMultiline(newHeight > 40);
              }}
            />
            <SendButton
              isLoading={isLoading}
              disabled={disabled || !inputValue.trim()}
              isMultiline={isMultiline}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
