import streamlit as st
import matplotlib.pyplot as plt
import networkx as nx
import random
import copy
from datetime import datetime
import pandas as pd

# -------------------------
# Petri Net Backend Logic
# -------------------------

def init_petri_net():
    G = nx.DiGraph()
    G.add_node('P0', type='place', tokens=1)
    G.add_node('P_out', type='place', tokens=0)
    G.add_node('T0', type='transition')
    G.add_edge('P0', 'T0')
    G.add_edge('T0', 'P_out')
    return G

# Rule implementations matching synthesis rules:

def abstraction_rule(G, t):
    """ψA: For transition t, add new place p_new and new transition t_new, reconnect edges."""
    # create new place
    p_new = f"P{len([n for n,d in G.nodes(data=True) if d['type']=='place'])}"
    G.add_node(p_new, type='place', tokens=0)
    # create new transition
    t_new = f"T{len([n for n,d in G.nodes(data=True) if d['type']=='transition'])}"
    G.add_node(t_new, type='transition')
    # reconnect: original outputs of t now go from t_new
    outputs = list(G.successors(t))
    for o in outputs:
        G.remove_edge(t, o)
        G.add_edge(t_new, o)
    # connect t -> p_new -> t_new
    G.add_edge(t, p_new)
    G.add_edge(p_new, t_new)
    return G


def linear_transition_rule(G, p):
    """ψT: For place p, add new transition t_new that consumes from p and produces to all p's successors."""
    t_new = f"T{len([n for n,d in G.nodes(data=True) if d['type']=='transition'])}"
    G.add_node(t_new, type='transition')
    # connect p -> t_new
    G.add_edge(p, t_new)
    # connect t_new -> all places that original transitions from p pointed to
    succ_trans = [v for u,v in G.out_edges(p) if G.nodes[v]['type']=='transition']
    output_places = set()
    for t in succ_trans:
        output_places.update([w for _,w in G.out_edges(t) if G.nodes[w]['type']=='place'])
    for op in output_places:
        G.add_edge(t_new, op)
    return G


def linear_place_rule(G, t):
    """ψP: For transition t, add new place p_new that is both input and output to t."""
    p_new = f"P{len([n for n,d in G.nodes(data=True) if d['type']=='place'])}"
    G.add_node(p_new, type='place', tokens=0)
    # connect all input places of t to new transition
    inputs = [u for u,_ in G.in_edges(t) if G.nodes[u]['type']=='place']
    for ip in inputs:
        G.remove_edge(ip, t)
        G.add_edge(ip, p_new)
    G.add_edge(p_new, t)
    return G


def dual_abstraction_rule(G, t):
    """ψD: Combination of abstraction (ψA) and linear transition (ψT) on t."""
    G = abstraction_rule(G, t)
    # identify new place from last abstraction
    new_places = [n for n,d in G.nodes(data=True) if d['type']=='place']
    p_new = new_places[-1]
    G = linear_transition_rule(G, p_new)
    return G

# Mapping for UI
rules_map = {
    'Abstraction ψA': abstraction_rule,
    'Linear Transition ψT': linear_transition_rule,
    'Linear Place ψP': linear_place_rule,
    'Dual Abstraction ψD': dual_abstraction_rule,
}

# -------------------------
# Streamlit App
# -------------------------

st.set_page_config(page_title='Petri Netz Manager', layout='wide')
st.title('Petri Netz Builder & Visualizer')

# Session state
if 'G' not in st.session_state:
    st.session_state.G = init_petri_net()
if 'log' not in st.session_state:
    st.session_state.log = []
if 'log_id' not in st.session_state:
    st.session_state.log_id = 1
if 'history' not in st.session_state:
    st.session_state.history = []

# Helper functions

def push_history():
    st.session_state.history.append((copy.deepcopy(st.session_state.G), st.session_state.log.copy(), st.session_state.log_id))

def record(action):
    entry = {'id': st.session_state.log_id,
             'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
             'action': action}
    st.session_state.log.append(entry)
    st.session_state.log_id += 1

# Sidebar controls
st.sidebar.header('Controls')
# Undo
if st.sidebar.button('Undo Last'):
    if st.session_state.history:
        G_prev, log_prev, log_id_prev = st.session_state.history.pop()
        st.session_state.G = G_prev
        st.session_state.log = log_prev
        st.session_state.log_id = log_id_prev
        st.success('Reverted to previous state')
    else:
        st.warning('No actions to undo')

# Reset
if st.sidebar.button('Reset to Default'):
    push_history()
    st.session_state.G = init_petri_net()
    st.session_state.log.clear()
    st.session_state.log_id = 1
    record('Reset to default net')

# Add Node
st.sidebar.subheader('Add Node')
new_place = st.sidebar.text_input('New Place Name', key='new_place')
if st.sidebar.button('Add Place') and new_place:
    push_history()
    st.session_state.G.add_node(new_place, type='place', tokens=0)
    record(f'Added place {new_place}')
new_trans = st.sidebar.text_input('New Transition Name', key='new_trans')
if st.sidebar.button('Add Transition') and new_trans:
    push_history()
    st.session_state.G.add_node(new_trans, type='transition')
    record(f'Added transition {new_trans}')

# Connect
st.sidebar.subheader('Add Connection')
nodes = list(st.session_state.G.nodes)
from_node = st.sidebar.selectbox('From Node', nodes, key='from')
to_node = st.sidebar.selectbox('To Node', nodes, key='to')
if st.sidebar.button('Connect'):
    push_history()
    st.session_state.G.add_edge(from_node, to_node)
    record(f'Connected {from_node} -> {to_node}')

# Apply Rule with selection
st.sidebar.subheader('Apply Synthesis Rule')
selected_rule = st.sidebar.selectbox('Select Rule', list(rules_map.keys()), key='rule')
# choose target
if selected_rule == 'Abstraction ψA' or selected_rule == 'Dual Abstraction ψD':
    choices = [n for n,d in st.session_state.G.nodes(data=True) if d['type']=='transition']
    target = st.sidebar.selectbox('Choose Transition', choices)
elif selected_rule == 'Linear Transition ψT':
    choices = [n for n,d in st.session_state.G.nodes(data=True) if d['type']=='place']
    target = st.sidebar.selectbox('Choose Place', choices)
else:  # Linear Place
    choices = [n for n,d in st.session_state.G.nodes(data=True) if d['type']=='transition']
    target = st.sidebar.selectbox('Choose Transition', choices)

if st.sidebar.button('Apply Rule'):
    push_history()
    # call rule with G and target
    st.session_state.G = rules_map[selected_rule](st.session_state.G, target)
    record(f'Applied {selected_rule} on {target}')

# Visualization
st.subheader('Petri Netz Visualization')
G = st.session_state.G
pos = nx.spring_layout(G, seed=42)
fig, ax = plt.subplots(figsize=(8,5))
nx.draw_networkx_nodes(G, pos, nodelist=[n for n,d in G.nodes(data=True) if d['type']=='place'], node_shape='o', node_color='skyblue', node_size=700, ax=ax)
nx.draw_networkx_nodes(G, pos, nodelist=[n for n,d in G.nodes(data=True) if d['type']=='transition'], node_shape='s', node_color='lightgreen', node_size=700, ax=ax)
nx.draw_networkx_edges(G, pos, arrowstyle='-|>', arrowsize=20, ax=ax)
nx.draw_networkx_labels(G, pos, ax=ax)
ax.set_title('Petri Netz')
ax.axis('off')
st.pyplot(fig)

# Log Display
st.subheader('Process Action Log')
if st.session_state.log:
    df = pd.DataFrame(st.session_state.log)
    st.dataframe(df)
    st.download_button('Download Log CSV', df.to_csv(index=False), file_name='petri_log.csv')
else:
    st.write('No actions yet.')

# Token Counts
st.subheader('Place Token Counts')
tokens = {n: d['tokens'] for n,d in G.nodes(data=True) if d['type']=='place'}
st.write(tokens)