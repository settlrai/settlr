type SendButtonProps = {
  isLoading: boolean;
  disabled: boolean;
  isMultiline?: boolean;
  isCompact?: boolean;
};

export default function SendButton({
  isLoading,
  disabled,
  isMultiline = false,
  isCompact = false,
}: SendButtonProps) {
  const baseClasses =
    "absolute px-4 py-2 text-gray-600 rounded-md focus:outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 enabled:cursor-pointer border border-transparent";

  const hoverClasses =
    !isLoading && !disabled ? "hover:text-gray-800 hover:cursor-pointer" : "";

  const positionClasses = isCompact
    ? "right-2 top-1/2 transform -translate-y-1/2"
    : isMultiline
    ? "right-2 bottom-0.5"
    : "right-2 top-1/2 transform -translate-y-1/2";

  return (
    <button
      type="submit"
      disabled={disabled}
      className={`${baseClasses} ${hoverClasses} ${positionClasses}`}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="sr-only">Sending...</span>
        </>
      ) : (
        "Send"
      )}
    </button>
  );
}
