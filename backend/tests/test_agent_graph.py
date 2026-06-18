"""Unit tests for agent graph assembly."""

from langchain_core.messages import AIMessage
from langgraph.graph import END
from langgraph.graph.state import CompiledStateGraph

from app.agent.graph import create_agent, should_continue


def test_should_continue_with_tool_calls():
    """Returns 'tools' if the last message has tool calls."""
    message = AIMessage(
        content="",
        tool_calls=[{"name": "execute_sql_query", "args": {"query": "SELECT 1"}, "id": "1"}]
    )
    state = {"messages": [message]}
    assert should_continue(state) == "tools"


def test_should_continue_without_tool_calls():
    """Returns END if the last message has no tool calls."""
    message = AIMessage(content="Hello there")
    state = {"messages": [message]}
    assert should_continue(state) == END


def test_should_continue_empty_messages():
    """Returns END if there are no messages."""
    state = {"messages": []}
    assert should_continue(state) == END


def test_create_agent_compiles():
    """Graph compilation succeeds without errors."""
    agent = create_agent()
    assert isinstance(agent, CompiledStateGraph)


def test_graph_topology_has_expected_nodes():
    """The compiled graph contains all expected nodes."""
    agent = create_agent()
    # langgraph 0.2 `get_graph` returns an object with nodes
    nodes = agent.get_graph().nodes
    node_names = set(nodes.keys())
    
    # Internal LangGraph START node is __start__
    assert "router" in node_names
    assert "core_agent" in node_names
    assert "fast_response" in node_names
    assert "tools" in node_names
