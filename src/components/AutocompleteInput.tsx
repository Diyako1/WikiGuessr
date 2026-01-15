'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (title: string) => void;
  isSelected: boolean;
  placeholder?: string;
  disabled?: boolean;
}

interface SearchResult {
  title: string;
  description?: string;
}

export default function AutocompleteInput({
  label,
  value,
  onChange,
  onSelect,
  isSelected,
  placeholder = 'Type to search...',
  disabled = false,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch suggestions
  useEffect(() => {
    if (!value || value.length < 2 || isSelected) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/wiki/search?q=${encodeURIComponent(value)}`,
          { signal: abortControllerRef.current.signal }
        );
        
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.results || []);
          setShowDropdown(true);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search error:', error);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, isSelected]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((title: string) => {
    onChange(title);
    onSelect(title);
    setShowDropdown(false);
    setSuggestions([]);
  }, [onChange, onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter' && value) {
        // Resolve the current input
        handleResolve();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(suggestions[highlightedIndex].title);
        } else if (value) {
          handleResolve();
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  const handleResolve = async () => {
    if (!value) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/wiki/resolve?q=${encodeURIComponent(value)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.title) {
          handleSelect(data.title);
        }
      }
    } catch (error) {
      console.error('Resolve error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    // Clear selection when typing
    if (isSelected) {
      onSelect('');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <label style={{ 
        display: 'block',
        fontFamily: 'sans-serif',
        fontSize: '0.95em',
        fontWeight: 'bold',
        marginBottom: '5px',
        color: '#000'
      }}>
        {label}
      </label>
      
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="wiki-input"
          style={{
            width: '100%',
            padding: '8px 12px',
            paddingRight: isSelected ? '36px' : '12px',
            borderColor: isSelected ? '#00af89' : '#a2a9b1',
            background: isSelected ? '#f0fff4' : '#fff'
          }}
        />
        
        {/* Selected checkmark */}
        {isSelected && (
          <span style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#00af89',
            fontSize: '1.2em'
          }}>
            ✓
          </span>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <span style={{
            position: 'absolute',
            right: isSelected ? '36px' : '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#72777d',
            fontSize: '0.8em'
          }}>
            ⏳
          </span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #a2a9b1',
            borderTop: 'none',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          {suggestions.map((result, index) => (
            <button
              key={result.title}
              onClick={() => handleSelect(result.title)}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                width: '100%',
                padding: '10px 12px',
                textAlign: 'left',
                border: 'none',
                borderBottom: index < suggestions.length - 1 ? '1px solid #eaecf0' : 'none',
                background: highlightedIndex === index ? '#eaf3ff' : '#fff',
                cursor: 'pointer',
                fontFamily: 'sans-serif'
              }}
            >
              <div style={{ 
                fontWeight: 'bold',
                color: '#0645ad',
                fontSize: '0.95em'
              }}>
                {result.title}
              </div>
              {result.description && (
                <div style={{ 
                  fontSize: '0.85em',
                  color: '#54595d',
                  marginTop: '2px'
                }}>
                  {result.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
