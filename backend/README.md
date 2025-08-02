# UrbanExplorer Backend

Simple AI agent implementation using Anthropic's API to provide London neighborhood recommendations based on lifestyle preferences.

## Setup

1. Install dependencies:
   ```bash
   uv sync
   ```

2. Create `.env` file with your Anthropic API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your API key
   ```

## Usage

Run the interactive agent:
```bash
python main.py
```

Type 'exit' or press Ctrl+C to quit.

## Features

- Interactive chat interface
- Loads system prompt from `../system-prompt.md`
- Maintains conversation history during session
- Raw request/response with minimal logging