from typing import TypedDict, Annotated, Sequence, Optional, Dict, Any, List
from langchain_core.messages import BaseMessage
import operator

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    intent: Optional[str]  # "people", "task", "doctrine", "reflection", "general"
    user_query: str
    action_taken: Optional[str]
    context_data: Optional[Dict[str, Any]]
    agent_scratchpad: Optional[List[str]]
    final_response: Optional[str]
