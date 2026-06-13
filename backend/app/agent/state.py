"""Agent state definition."""

from typing import Annotated, Any, Dict, Sequence, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    """State for the EduInsight LangGraph Agent.
    
    Uses `total=False` to allow partial updates.
    """
    
    # Reducer: append or update messages in the list
    messages: Annotated[Sequence[BaseMessage], add_messages]
    
    # UI Context (e.g. current department/program being viewed)
    context: Dict[str, Any]
    
    # Temporary results from tools (e.g. SQL data)
    sql_results: list[str]
    
    # Error string if something fails gracefully
    error: str
