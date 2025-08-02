import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
import json
import os

Base = declarative_base()

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    title = Column(String(255))
    meta_data = Column(Text)  # JSON string
    
    # Relationship to messages
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "title": self.title,
            "metadata": json.loads(self.meta_data) if self.meta_data else {},
            "message_count": len(self.messages)
        }

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user', 'assistant'
    content = Column(Text, nullable=False)
    tool_calls = Column(Text)  # JSON string of tool calls
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to conversation
    conversation = relationship("Conversation", back_populates="messages")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "tool_calls": json.loads(self.tool_calls) if self.tool_calls else None,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
    
    def to_anthropic_format(self) -> Dict[str, Any]:
        """Convert to Anthropic API message format."""
        message = {
            "role": self.role,
            "content": self.content
        }
        
        # Add tool calls if present (for assistant messages)
        if self.tool_calls and self.role == "assistant":
            tool_calls_data = json.loads(self.tool_calls)
            if tool_calls_data:
                # Anthropic expects content to be a list when tool calls are present
                content_blocks = []
                if self.content:
                    content_blocks.append({"type": "text", "text": self.content})
                content_blocks.extend(tool_calls_data)
                message["content"] = content_blocks
        
        return message

class DatabaseManager:
    """Manages database connection and operations."""
    
    def __init__(self, database_url: Optional[str] = None):
        if database_url is None:
            # Default to local SQLite database
            db_path = os.getenv("DATABASE_PATH", "conversations.db")
            database_url = f"sqlite:///{db_path}"
        
        self.engine = create_engine(database_url, echo=False)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Create tables
        Base.metadata.create_all(bind=self.engine)
    
    def get_session(self) -> Session:
        """Get a database session."""
        return self.SessionLocal()
    
    def create_conversation(self, first_message: str, title: Optional[str] = None) -> Conversation:
        """Create a new conversation with the first user message."""
        with self.get_session() as session:
            # Generate title from first message if not provided
            if title is None:
                title = self._generate_title(first_message)
            
            conversation = Conversation(
                title=title,
                meta_data=json.dumps({})
            )
            session.add(conversation)
            session.flush()  # Get the ID
            
            # Add the first user message
            first_msg = Message(
                conversation_id=conversation.id,
                role="user",
                content=first_message
            )
            session.add(first_msg)
            session.commit()
            session.refresh(conversation)
            
            return conversation
    
    def create_conversation_with_id(self, conversation_id: str, first_message: str, title: Optional[str] = None) -> Conversation:
        """Create a new conversation with a specific ID and first user message."""
        with self.get_session() as session:
            # Generate title from first message if not provided
            if title is None:
                title = self._generate_title(first_message)
            
            conversation = Conversation(
                id=conversation_id,
                title=title,
                meta_data=json.dumps({})
            )
            session.add(conversation)
            session.flush()  # Get the ID
            
            # Add the first user message
            first_msg = Message(
                conversation_id=conversation.id,
                role="user",
                content=first_message
            )
            session.add(first_msg)
            session.commit()
            session.refresh(conversation)
            
            return conversation
    
    def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """Get a conversation by ID."""
        with self.get_session() as session:
            return session.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    def add_message(self, conversation_id: str, role: str, content: str, tool_calls: Optional[List[Dict]] = None) -> Message:
        """Add a message to a conversation."""
        with self.get_session() as session:
            message = Message(
                conversation_id=conversation_id,
                role=role,
                content=content,
                tool_calls=json.dumps(tool_calls) if tool_calls else None
            )
            session.add(message)
            
            # Update conversation updated_at
            conversation = session.query(Conversation).filter(Conversation.id == conversation_id).first()
            if conversation:
                conversation.updated_at = datetime.utcnow()
            
            session.commit()
            session.refresh(message)
            
            return message
    
    def get_messages(self, conversation_id: str) -> List[Message]:
        """Get all messages for a conversation, ordered by timestamp."""
        with self.get_session() as session:
            return session.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.timestamp).all()
    
    def get_conversation_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Get conversation history in Anthropic API format."""
        messages = self.get_messages(conversation_id)
        return [msg.to_anthropic_format() for msg in messages]
    
    def _generate_title(self, first_message: str, max_length: int = 50) -> str:
        """Generate a conversation title from the first message."""
        # Clean and truncate the message
        title = first_message.strip()
        if len(title) > max_length:
            title = title[:max_length].rsplit(' ', 1)[0] + "..."
        return title or "New Conversation"

# Global database manager instance
db_manager: Optional[DatabaseManager] = None

def get_db_manager() -> DatabaseManager:
    """Get the global database manager instance."""
    global db_manager
    if db_manager is None:
        db_manager = DatabaseManager()
    return db_manager

def init_database():
    """Initialize the database on startup."""
    global db_manager
    db_manager = DatabaseManager()
    print("✅ Database initialized")