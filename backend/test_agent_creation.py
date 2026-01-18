#!/usr/bin/env python3
import sys
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

sys.path.insert(0, str(Path(__file__).parent))

from config import ELEVENLABS_API_KEY
from routes.elevenlabs import AgentCreator

def test_agent_creation():
    if not ELEVENLABS_API_KEY:
        print("ERROR: ELEVENLABS_API_KEY not set in environment")
        return False
    
    print("✓ ELEVENLABS_API_KEY found")
    
    test_user_id = "test_user_123"
    test_document_id = "test_doc_456"
    
    test_content = """
This is a test document for agent creation.
It contains some sample content that can be used to test
the knowledge base functionality.
The secret number is 8891.
"""
    
    with NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(test_content)
        test_file_path = f.name
    
    try:
        print(f"Creating agent with user_id={test_user_id}, document_id={test_document_id}")
        
        with open(test_file_path, 'rb') as doc_file:
            creator = AgentCreator(
                user_id=test_user_id,
                document_id=test_document_id,
                document_file=doc_file
            )
        
        print(f"✓ Agent created successfully")
        print(f"  Agent ID: {creator.agent_id}")
        print(f"  Agent ID (from API): {creator.agent.agent_id}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: Agent creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if os.path.exists(test_file_path):
            os.unlink(test_file_path)

if __name__ == "__main__":
    success = test_agent_creation()
    sys.exit(0 if success else 1)
