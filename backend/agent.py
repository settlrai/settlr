import os
from pathlib import Path
import anthropic
from dotenv import load_dotenv

class UrbanExplorer:
    def __init__(self):
        load_dotenv()
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.system_prompt = self._load_system_prompt()
        
    def _load_system_prompt(self):
        prompt_path = Path(__file__).parent.parent / "system-prompt.md"
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def chat(self, user_message, conversation_history=None):
        if conversation_history is None:
            conversation_history = []
        
        messages = conversation_history + [{"role": "user", "content": user_message}]
        
        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            system=self.system_prompt,
            messages=messages
        )
        
        return response.content[0].text
    
    def run_interactive(self):
        conversation_history = []
        
        print("UrbanExplorer is ready! Type 'exit' to quit.")
        
        while True:
            try:
                user_input = input("\nYou: ").strip()
                
                if user_input.lower() in ['exit', 'quit']:
                    break
                
                if not user_input:
                    continue
                
                response = self.chat(user_input, conversation_history)
                print(f"\nUrbanExplorer: {response}")
                
                conversation_history.extend([
                    {"role": "user", "content": user_input},
                    {"role": "assistant", "content": response}
                ])
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")
        
        print("\nGoodbye!")