#!/usr/bin/env python3
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import ELEVENLABS_API_KEY
from elevenlabs import ElevenLabs

def dump_agent_configs(agent_id_1: str, agent_id_2: str, output_file: str = "agent_configs.json"):
    if not ELEVENLABS_API_KEY:
        print("ERROR: ELEVENLABS_API_KEY not set in environment")
        sys.exit(1)
    
    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    
    agent_1 = client.conversational_ai.agents.get(agent_id_1)
    agent_2 = client.conversational_ai.agents.get(agent_id_2)
    
    configs = {
        "agent_1": {
            "agent_id": agent_id_1,
            "config": agent_1.model_dump()
        },
        "agent_2": {
            "agent_id": agent_id_2,
            "config": agent_2.model_dump()
        }
    }
    
    with open(output_file, 'w') as f:
        json.dump(configs, f, indent=2)
    
    print(f"Configs dumped to {output_file}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python dump_agent_configs.py <agent_id_1> <agent_id_2> [output_file]")
        sys.exit(1)
    
    agent_id_1 = sys.argv[1]
    agent_id_2 = sys.argv[2]
    output_file = sys.argv[3] if len(sys.argv) > 3 else "agent_configs.json"
    
    dump_agent_configs(agent_id_1, agent_id_2, output_file)
