'use client';

import { useState, useRef, useEffect } from 'react';

interface DraggableChatProps {
  onFirstMessage?: () => void;
}

export default function DraggableChat({ onFirstMessage }: DraggableChatProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasMovedToSide, setHasMovedToSide] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!chatRef.current) return;
    
    setIsDragging(true);
    const rect = chatRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !chatRef.current) return;
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    const maxX = window.innerWidth - chatRef.current.offsetWidth;
    const maxY = window.innerHeight - chatRef.current.offsetHeight;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setMessages(prev => [...prev, inputValue]);
    setInputValue('');

    if (!hasMovedToSide) {
      setHasMovedToSide(true);
      const rightPosition = window.innerWidth - 400 - 20;
      const centerY = (window.innerHeight - 500) / 2;
      setPosition({ x: rightPosition, y: centerY });
      onFirstMessage?.();
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (!hasMovedToSide) {
      const centerX = (window.innerWidth - 400) / 2;
      const centerY = (window.innerHeight - 500) / 2;
      setPosition({ x: centerX, y: centerY });
    }
  }, [hasMovedToSide]);

  return (
    <div
      ref={chatRef}
      className={`fixed w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 cursor-move transition-all duration-700 ease-in-out ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: hasMovedToSide ? 'none' : 'translate(0, 0)'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {messages.map((message, index) => (
              <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                {message}
              </div>
            ))}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}