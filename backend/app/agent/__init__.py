"""EduInsight LangGraph Agent package.

Usage::

    from app.agent import create_agent
    agent = create_agent()
    result = await agent.ainvoke({"messages": [HumanMessage(content="...")]})
"""

from app.agent.graph import create_agent

__all__ = ["create_agent"]
