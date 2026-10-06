from langgraph.graph import StateGraph, END
from langchain_core.messages import AIMessage
from backend.app.agents.state import AgentState
from backend.app.agents.supervisor import classify_intent
from backend.app.agents.people_agent import run_people_agent
from backend.app.agents.task_agent import run_task_agent
from backend.app.agents.doctrine_coach import run_doctrine_coach

def supervisor_node(state: AgentState) -> dict:
    query = state.get("user_query", "")
    intent = classify_intent(query)
    return {"intent": intent}

def people_node(state: AgentState) -> dict:
    res = run_people_agent(state["user_query"])
    return {
        "agent_scratchpad": [res["response"]],
        "context_data": res.get("context", {})
    }

def task_node(state: AgentState) -> dict:
    res = run_task_agent(state["user_query"])
    return {
        "agent_scratchpad": [res["response"]],
        "context_data": res.get("context", {})
    }

def doctrine_node(state: AgentState) -> dict:
    res = run_doctrine_coach(state["user_query"])
    return {
        "agent_scratchpad": [res["response"]],
        "context_data": res.get("context", {})
    }

def synthesizer_node(state: AgentState) -> dict:
    scratchpad = state.get("agent_scratchpad", [])
    final_text = "\n\n".join(scratchpad) if scratchpad else "לא התקבל מענה מהסוכנים."
    return {
        "final_response": final_text,
        "messages": [AIMessage(content=final_text)]
    }

def route_next(state: AgentState) -> str:
    intent = state.get("intent", "task")
    if intent == "people":
        return "people"
    elif intent == "doctrine":
        return "doctrine"
    return "task"

# Build Graph
builder = StateGraph(AgentState)

builder.add_node("supervisor", supervisor_node)
builder.add_node("people", people_node)
builder.add_node("task", task_node)
builder.add_node("doctrine", doctrine_node)
builder.add_node("synthesizer", synthesizer_node)

builder.set_entry_point("supervisor")

builder.add_conditional_edges(
    "supervisor",
    route_next,
    {
        "people": "people",
        "task": "task",
        "doctrine": "doctrine"
    }
)

builder.add_edge("people", "synthesizer")
builder.add_edge("task", "synthesizer")
builder.add_edge("doctrine", "synthesizer")
builder.add_edge("synthesizer", END)

ramad_multi_agent_graph = builder.compile()
