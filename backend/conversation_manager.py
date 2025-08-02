from typing import Optional, List, Dict, Any
from database import get_db_manager, Conversation, Message
import logging

logger = logging.getLogger(__name__)

class ConversationManager:
    """Manages conversation state and database operations."""
    
    def __init__(self):
        self.db = get_db_manager()
    
    def create_conversation(self, first_message: str, title: Optional[str] = None) -> str:
        """
        Create a new conversation with the first user message.
        
        Args:
            first_message: The first user message
            title: Optional conversation title (auto-generated if not provided)
            
        Returns:
            conversation_id: The ID of the created conversation
        """
        try:
            conversation = self.db.create_conversation(first_message, title)
            logger.info(f"Created new conversation: {conversation.id}")
            return conversation.id
        except Exception as e:
            logger.error(f"Error creating conversation: {e}")
            raise
    
    def create_conversation_with_id(self, conversation_id: str, first_message: str, title: Optional[str] = None) -> bool:
        """
        Create a new conversation with a specific ID and first user message.
        
        Args:
            conversation_id: The client-provided conversation ID
            first_message: The first user message
            title: Optional conversation title (auto-generated if not provided)
            
        Returns:
            Success status
        """
        try:
            conversation = self.db.create_conversation_with_id(conversation_id, first_message, title)
            logger.info(f"Created new conversation with ID: {conversation_id}")
            return True
        except Exception as e:
            logger.error(f"Error creating conversation with ID {conversation_id}: {e}")
            raise
    
    def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """
        Get conversation details.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            Conversation dict or None if not found
        """
        try:
            conversation = self.db.get_conversation(conversation_id)
            return conversation.to_dict() if conversation else None
        except Exception as e:
            logger.error(f"Error getting conversation {conversation_id}: {e}")
            return None
    
    def add_user_message(self, conversation_id: str, message: str) -> bool:
        """
        Add a user message to the conversation.
        
        Args:
            conversation_id: The conversation ID
            message: The user message content
            
        Returns:
            Success status
        """
        try:
            self.db.add_message(conversation_id, "user", message)
            logger.info(f"Added user message to conversation {conversation_id}")
            return True
        except Exception as e:
            logger.error(f"Error adding user message to {conversation_id}: {e}")
            return False
    
    def add_assistant_message(self, conversation_id: str, content: str, tool_calls: Optional[List[Dict]] = None) -> bool:
        """
        Add an assistant message to the conversation.
        
        Args:
            conversation_id: The conversation ID
            content: The assistant message content
            tool_calls: Optional tool calls data
            
        Returns:
            Success status
        """
        try:
            self.db.add_message(conversation_id, "assistant", content, tool_calls)
            logger.info(f"Added assistant message to conversation {conversation_id}")
            return True
        except Exception as e:
            logger.error(f"Error adding assistant message to {conversation_id}: {e}")
            return False
    
    def get_conversation_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        """
        Get conversation history in Anthropic API format.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            List of messages in Anthropic format
        """
        try:
            history = self.db.get_conversation_history(conversation_id)
            logger.info(f"Retrieved {len(history)} messages for conversation {conversation_id}")
            return history
        except Exception as e:
            logger.error(f"Error getting conversation history for {conversation_id}: {e}")
            return []
    
    def conversation_exists(self, conversation_id: str) -> bool:
        """
        Check if a conversation exists.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            True if conversation exists, False otherwise
        """
        try:
            conversation = self.db.get_conversation(conversation_id)
            return conversation is not None
        except Exception as e:
            logger.error(f"Error checking if conversation {conversation_id} exists: {e}")
            return False
    
    def get_message_count(self, conversation_id: str) -> int:
        """
        Get the number of messages in a conversation.
        
        Args:
            conversation_id: The conversation ID
            
        Returns:
            Number of messages
        """
        try:
            messages = self.db.get_messages(conversation_id)
            return len(messages)
        except Exception as e:
            logger.error(f"Error getting message count for {conversation_id}: {e}")
            return 0
    
    def extract_tool_calls_from_response(self, response_content: List[Any]) -> Optional[List[Dict]]:
        """
        Extract tool calls from Anthropic response content.
        
        Args:
            response_content: The response content blocks from Anthropic
            
        Returns:
            List of tool call dicts or None
        """
        tool_calls = []
        
        for block in response_content:
            if hasattr(block, 'type') and block.type == "tool_use":
                tool_calls.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input
                })
        
        return tool_calls if tool_calls else None
    
    def extract_text_from_response(self, response_content: List[Any]) -> str:
        """
        Extract text content from Anthropic response content.
        
        Args:
            response_content: The response content blocks from Anthropic
            
        Returns:
            Combined text content
        """
        text_parts = []
        
        for block in response_content:
            if hasattr(block, 'type') and block.type == "text":
                text_parts.append(block.text)
        
        return "".join(text_parts)

# Global conversation manager instance
conversation_manager: Optional[ConversationManager] = None

def get_conversation_manager() -> ConversationManager:
    """Get the global conversation manager instance."""
    global conversation_manager
    if conversation_manager is None:
        conversation_manager = ConversationManager()
    return conversation_manager