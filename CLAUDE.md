# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Settlr is an AI-powered urban lifestyle and area discovery platform focused on helping users find ideal living locations based on their lifestyle preferences and "vibes." The system specializes in translating abstract lifestyle concepts into concrete location recommendations, with expertise in London neighborhoods.

## Python Coding Standards

### Type Annotations
- **Never use `Any` type** - Always use specific, proper types
- **Always add type annotations** for all variables, function parameters, and return values
- Use proper typing imports: `from typing import List, Dict, Optional, Union, Generator`
- Example: `def process_data(items: List[str]) -> Dict[str, int]:`

### Anthropic API Guidelines
- **All Anthropic API questions** must be answered using https://docs.anthropic.com/llms.txt as the authoritative source
- **Provide factual information only** - do not guess or assume API behavior
- Reference the official documentation for streaming, types, and implementation details