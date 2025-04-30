
import dash
from dash import dcc, html, Input, Output, State, callback, no_update, ctx
import dash_cytoscape as cyto
import json
import pandas as pd
import networkx as nx
from datetime import datetime

# Load Cytoscape.js's Dagre extension for layout
cyto.load_extra_layouts()

# Initialize the Dash app
app = dash.Dash(__name__, suppress_callback_exceptions=True)
server = app.server

# Global variables to track state
initial_elements = [
    # Default empty graph
]

# Define styles for different node types
stylesheet = [
    # Group selectors
    {
        'selector': 'node',
        'style': {
            'content': 'data(id)',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': '40px',
            'height': '40px',
            'font-size': '12px',
        }
    },
    {
        'selector': 'node[type="place"]',
        'style': {
            'background-color': '#9b87f5',
            'shape': 'ellipse',
        }
    },
    {
        'selector': 'node[type="transition"]',
        'style': {
            'background-color': '#6E59A5',
            'shape': 'rectangle',
            'width': '30px',
            'height': '10px',
        }
    },
    {
        'selector': 'edge',
        'style': {
            'width': 2,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#9F9EA1',
            'target-arrow-color': '#9F9EA1',
        }
    },
    {
        'selector': 'node[tokens > 0]',
        'style': {
            'label': 'data(tokens)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-margin-y': -5,
            'font-size': '16px',
            'font-weight': 'bold',
            'color': '#000',
        }
    },
    {
        'selector': '.simulation-path',
        'style': {
            'line-color': '#ea384c',
            'target-arrow-color': '#ea384c',
            'width': 3,
        }
    },
    {
        'selector': 'node.start-node',
        'style': {
            'border-width': '3px',
            'border-color': '#0EA5E9',
            'border-style': 'solid',
        }
    },
    {
        'selector': 'node.end-node',
        'style': {
            'border-width': '3px',
            'border-color': '#F97316',
            'border-style': 'solid',
        }
    }
]

# Define the initial layout of the app
app.layout = html.Div([
    # Store components for maintaining state
    dcc.Store(id='cytoscape-elements', data=initial_elements),
    dcc.Store(id='petri-net-log', data=[]),
    dcc.Store(id='simulation-state', data={'running': False, 'steps': 0}),
    dcc.Store(id='selected-nodes', data={'start': None, 'end': None}),
    
    # Main layout
    html.Div([
        # Header
        html.H1("Petri Net Simulator", style={'textAlign': 'center', 'marginBottom': '20px', 'color': '#1A1F2C'}),
        
        # Main content area
        html.Div([
            # Left sidebar
            html.Div([
                html.Div([
                    html.H3("Add Elements", style={'marginBottom': '10px'}),
                    html.Button("Add Place", id="add-place-btn", className="control-btn", 
                               style={'marginRight': '10px', 'backgroundColor': '#9b87f5', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                    html.Button("Add Transition", id="add-transition-btn", className="control-btn",
                               style={'backgroundColor': '#6E59A5', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                ], style={'marginBottom': '20px'}),
                
                html.Div([
                    html.H3("Connection Mode", style={'marginBottom': '10px'}),
                    dcc.RadioItems(
                        id="connection-mode",
                        options=[
                            {'label': 'Select', 'value': 'select'},
                            {'label': 'Connect', 'value': 'connect'},
                        ],
                        value='select',
                        labelStyle={'display': 'block', 'marginBottom': '5px'}
                    ),
                ], style={'marginBottom': '20px'}),
                
                html.Div([
                    html.H3("Set Start/End", style={'marginBottom': '10px'}),
                    html.Button("Set Start Node", id="set-start-node-btn", className="control-btn",
                               style={'marginRight': '10px', 'backgroundColor': '#0EA5E9', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                    html.Button("Set End Node", id="set-end-node-btn", className="control-btn",
                               style={'backgroundColor': '#F97316', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                ], style={'marginBottom': '20px'}),
                
                html.Div([
                    html.H3("Tokens", style={'marginBottom': '10px'}),
                    html.Button("Add Token", id="add-token-btn", className="control-btn",
                               style={'marginRight': '10px', 'backgroundColor': '#8B5CF6', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                    html.Button("Remove Token", id="remove-token-btn", className="control-btn",
                               style={'backgroundColor': '#D946EF', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                ], style={'marginBottom': '20px'}),
                
                html.Div([
                    html.H3("Simulation", style={'marginBottom': '10px'}),
                    html.Button("Run Simulation", id="run-simulation-btn", className="control-btn",
                               style={'marginRight': '10px', 'backgroundColor': '#10B981', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                    html.Button("Stop Simulation", id="stop-simulation-btn", className="control-btn",
                               style={'backgroundColor': '#EF4444', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': 'white'}),
                ], style={'marginBottom': '20px'}),
                
                html.Div([
                    html.H3("Settings", style={'marginBottom': '10px'}),
                    html.Button("Clear Graph", id="clear-graph-btn", className="control-btn",
                               style={'backgroundColor': '#E5E7EB', 'border': 'none', 'padding': '8px 15px', 'borderRadius': '4px', 'color': '#374151'}),
                ], style={'marginBottom': '20px'}),
                
                # Token Counter
                html.Div([
                    html.H3("Token Counter", style={'marginBottom': '10px'}),
                    html.Div(id='token-counter', style={'fontSize': '16px', 'fontWeight': 'bold'})
                ], style={'marginBottom': '20px'}),
            ], style={'width': '25%', 'padding': '20px', 'backgroundColor': '#F1F0FB', 'borderRadius': '8px', 'boxShadow': '0 2px 4px rgba(0,0,0,0.1)'}),
            
            # Center main graph
            html.Div([
                cyto.Cytoscape(
                    id='cytoscape-petri',
                    layout={'name': 'dagre'},
                    style={'width': '100%', 'height': '600px', 'backgroundColor': '#FFFFFF', 'borderRadius': '8px'},
                    stylesheet=stylesheet,
                    elements=initial_elements,
                    boxSelectionEnabled=True,
                    minZoom=0.5,
                    maxZoom=2,
                )
            ], style={'width': '50%', 'padding': '20px'}),
            
            # Right sidebar for logs and information
            html.Div([
                html.H3("Simulation Log", style={'marginBottom': '10px'}),
                html.Div(
                    id='log-container',
                    style={
                        'height': '600px',
                        'overflowY': 'auto',
                        'padding': '10px',
                        'backgroundColor': '#FFFFFF',
                        'borderRadius': '8px',
                        'boxShadow': '0 2px 4px rgba(0,0,0,0.1)'
                    },
                    children=[
                        html.Div(id='simulation-log-table')
                    ]
                )
            ], style={'width': '25%', 'padding': '20px'})
        ], style={'display': 'flex', 'flexDirection': 'row', 'marginBottom': '20px'})
    ], style={'fontFamily': 'Arial, sans-serif', 'maxWidth': '1600px', 'margin': '0 auto', 'padding': '20px'})
])

# Helper functions

def create_place(id_suffix):
    return {
        'data': {
            'id': f'place_{id_suffix}',
            'label': f'P{id_suffix}',
            'type': 'place',
            'tokens': 0
        },
        'classes': ''
    }

def create_transition(id_suffix):
    return {
        'data': {
            'id': f'transition_{id_suffix}',
            'label': f'T{id_suffix}',
            'type': 'transition'
        },
        'classes': ''
    }

def create_edge(source, target):
    return {
        'data': {
            'id': f'{source}-to-{target}',
            'source': source,
            'target': target
        }
    }

def get_element_by_id(elements, element_id):
    for element in elements:
        if 'data' in element and element['data'].get('id') == element_id:
            return element
    return None

def count_tokens(elements):
    total = 0
    for element in elements:
        if 'data' in element and element['data'].get('type') == 'place':
            tokens = element['data'].get('tokens', 0)
            if isinstance(tokens, (int, float)):
                total += tokens
    return total

def convert_to_networkx(elements):
    G = nx.DiGraph()
    
    # Add nodes
    for element in elements:
        if 'data' in element and 'id' in element['data'] and 'source' not in element['data']:
            node_id = element['data']['id']
            node_type = element['data'].get('type', '')
            tokens = element['data'].get('tokens', 0) if node_type == 'place' else 0
            G.add_node(node_id, type=node_type, tokens=tokens)
    
    # Add edges
    for element in elements:
        if 'data' in element and 'source' in element['data'] and 'target' in element['data']:
            source = element['data']['source']
            target = element['data']['target']
            G.add_edge(source, target)
    
    return G

def is_enabled(G, transition_id):
    """Check if a transition is enabled (all input places have at least one token)"""
    input_places = list(G.predecessors(transition_id))
    if not input_places:
        return False
    
    for place_id in input_places:
        if G.nodes[place_id].get('tokens', 0) <= 0:
            return False
    return True

def execute_transition(elements, transition_id):
    """Execute a transition by moving tokens from input places to output places"""
    G = convert_to_networkx(elements)
    
    if not is_enabled(G, transition_id):
        return elements, False
    
    # Find input and output places
    input_places = list(G.predecessors(transition_id))
    output_places = list(G.successors(transition_id))
    
    # Remove tokens from input places
    updated_elements = elements.copy()
    for i, element in enumerate(updated_elements):
        if 'data' in element and element['data'].get('id') in input_places:
            updated_elements[i]['data']['tokens'] = max(0, element['data'].get('tokens', 0) - 1)
    
    # Add tokens to output places
    for i, element in enumerate(updated_elements):
        if 'data' in element and element['data'].get('id') in output_places:
            updated_elements[i]['data']['tokens'] = element['data'].get('tokens', 0) + 1
    
    return updated_elements, True

def find_reachable_transitions(G, marked_edges=None):
    """Find all enabled transitions in the network"""
    if marked_edges is None:
        marked_edges = set()
    
    enabled_transitions = []
    for node in G.nodes():
        if G.nodes[node].get('type') == 'transition' and is_enabled(G, node):
            # For each enabled transition, add the input edges to the list
            for input_place in G.predecessors(node):
                edge_id = f"{input_place}-to-{node}"
                if edge_id not in marked_edges:
                    enabled_transitions.append((node, input_place, edge_id))
    
    return enabled_transitions

def run_simulation_step(elements, simulation_path):
    """Run one simulation step and return updated elements and simulation paths"""
    G = convert_to_networkx(elements)
    
    # Find all enabled transitions
    reachable_transitions = find_reachable_transitions(G, {edge for _, _, edge in simulation_path})
    
    if not reachable_transitions:
        return elements, simulation_path, False  # No enabled transitions
    
    # Execute the first enabled transition found
    if reachable_transitions:
        transition_id, input_place, edge_id = reachable_transitions[0]
        updated_elements, success = execute_transition(elements, transition_id)
        if success:
            # Mark input edges
            simulation_path.append((transition_id, input_place, edge_id))
            # Mark output edges
            for output_place in G.successors(transition_id):
                edge_id = f"{transition_id}-to-{output_place}"
                simulation_path.append((output_place, transition_id, edge_id))
            return updated_elements, simulation_path, True
    
    return elements, simulation_path, False

def reset_simulation_paths(elements):
    """Remove all simulation-path classes from edges"""
    updated_elements = elements.copy()
    for i, element in enumerate(updated_elements):
        if 'classes' in element and 'simulation-path' in element['classes']:
            updated_elements[i]['classes'] = element['classes'].replace('simulation-path', '').strip()
    return updated_elements

def apply_simulation_path_classes(elements, simulation_path):
    """Apply simulation-path class to edges in the simulation path"""
    updated_elements = elements.copy()
    edge_ids = {edge_id for _, _, edge_id in simulation_path}
    
    for i, element in enumerate(updated_elements):
        if 'data' in element and 'source' in element['data'] and 'target' in element['data']:
            edge_id = element['data']['id']
            if edge_id in edge_ids:
                if 'classes' not in updated_elements[i]:
                    updated_elements[i]['classes'] = ''
                if 'simulation-path' not in updated_elements[i]['classes']:
                    updated_elements[i]['classes'] += ' simulation-path'
    return updated_elements


# Callback functions

@callback(
    Output('cytoscape-elements', 'data'),
    Output('petri-net-log', 'data'),
    [Input('add-place-btn', 'n_clicks'),
     Input('add-transition-btn', 'n_clicks'),
     Input('clear-graph-btn', 'n_clicks'),
     Input('cytoscape-petri', 'tapEdgeData')],
    [State('cytoscape-elements', 'data'),
     State('petri-net-log', 'data'),
     State('connection-mode', 'value'),
     State('cytoscape-petri', 'selectedNodeData')],
    prevent_initial_call=True
)
def update_elements(add_place, add_transition, clear_graph, edge_data, elements, log_data, connection_mode, selected_nodes):
    if not ctx.triggered:
        return no_update, no_update
    
    trigger_id = ctx.triggered[0]['prop_id'].split('.')[0]
    updated_elements = elements.copy() if elements else []
    updated_log = log_data.copy() if log_data else []
    
    if trigger_id == 'add-place-btn':
        place_count = sum(1 for element in updated_elements if 'data' in element and element['data'].get('type') == 'place')
        new_place = create_place(place_count + 1)
        updated_elements.append(new_place)
        updated_log.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'action': 'Added place',
            'details': f"Place P{place_count + 1} added"
        })
    
    elif trigger_id == 'add-transition-btn':
        transition_count = sum(1 for element in updated_elements if 'data' in element and element['data'].get('type') == 'transition')
        new_transition = create_transition(transition_count + 1)
        updated_elements.append(new_transition)
        updated_log.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'action': 'Added transition',
            'details': f"Transition T{transition_count + 1} added"
        })
    
    elif trigger_id == 'clear-graph-btn':
        updated_elements = []
        updated_log.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'action': 'Cleared graph',
            'details': 'All nodes and edges removed'
        })
    
    return updated_elements, updated_log

@callback(
    Output('cytoscape-petri', 'elements'),
    [Input('cytoscape-elements', 'data'),
     Input('simulation-state', 'data'),
     Input('selected-nodes', 'data')]
)
def update_cytoscape_graph(elements_data, simulation_state, selected_nodes):
    elements = elements_data.copy() if elements_data else []
    
    # Reset all node classes first
    for i, element in enumerate(elements):
        if 'data' in element and 'source' not in element['data']:
            elements[i]['classes'] = elements[i].get('classes', '').replace('start-node', '').replace('end-node', '').strip()
    
    # Apply selected node classes
    if selected_nodes:
        start_node = selected_nodes.get('start')
        end_node = selected_nodes.get('end')
        
        for i, element in enumerate(elements):
            if 'data' in element and element['data'].get('id') == start_node:
                if 'classes' not in elements[i]:
                    elements[i]['classes'] = ''
                elements[i]['classes'] += ' start-node'
            
            if 'data' in element and element['data'].get('id') == end_node:
                if 'classes' not in elements[i]:
                    elements[i]['classes'] = ''
                elements[i]['classes'] += ' end-node'
    
    return elements

@callback(
    Output('cytoscape-elements', 'data', allow_duplicate=True),
    Output('petri-net-log', 'data', allow_duplicate=True),
    [Input('cytoscape-petri', 'tapNodeData')],
    [State('cytoscape-elements', 'data'),
     State('petri-net-log', 'data'),
     State('connection-mode', 'value')],
    prevent_initial_call=True
)
def handle_node_tap(node_data, elements, log_data, connection_mode):
    if not node_data:
        return no_update, no_update
    
    updated_elements = elements.copy()
    updated_log = log_data.copy()
    
    if connection_mode == 'connect':
        # In connect mode, we're selecting nodes to create edges
        # This is handled by another callback
        pass
    
    return updated_elements, updated_log

@callback(
    Output('cytoscape-elements', 'data', allow_duplicate=True),
    Output('petri-net-log', 'data', allow_duplicate=True),
    [Input('add-token-btn', 'n_clicks'),
     Input('remove-token-btn', 'n_clicks')],
    [State('cytoscape-elements', 'data'),
     State('petri-net-log', 'data'),
     State('cytoscape-petri', 'selectedNodeData')],
    prevent_initial_call=True
)
def handle_tokens(add_token, remove_token, elements, log_data, selected_nodes):
    if not ctx.triggered:
        return no_update, no_update
    
    trigger_id = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if not selected_nodes or not selected_nodes[0]:
        return no_update, no_update
    
    node_id = selected_nodes[0]['id']
    node_type = selected_nodes[0].get('type')
    
    if node_type != 'place':
        return no_update, no_update
    
    updated_elements = elements.copy()
    updated_log = log_data.copy()
    
    # Find the selected node in elements
    for i, element in enumerate(updated_elements):
        if 'data' in element and element['data'].get('id') == node_id:
            current_tokens = element['data'].get('tokens', 0)
            
            if trigger_id == 'add-token-btn':
                updated_elements[i]['data']['tokens'] = current_tokens + 1
                updated_log.append({
                    'timestamp': datetime.now().strftime('%H:%M:%S'),
                    'action': 'Added token',
                    'details': f"Token added to {node_id}"
                })
                break
            
            elif trigger_id == 'remove-token-btn' and current_tokens > 0:
                updated_elements[i]['data']['tokens'] = current_tokens - 1
                updated_log.append({
                    'timestamp': datetime.now().strftime('%H:%M:%S'),
                    'action': 'Removed token',
                    'details': f"Token removed from {node_id}"
                })
                break
    
    return updated_elements, updated_log

@callback(
    Output('selected-nodes', 'data'),
    Output('petri-net-log', 'data', allow_duplicate=True),
    [Input('set-start-node-btn', 'n_clicks'),
     Input('set-end-node-btn', 'n_clicks')],
    [State('cytoscape-petri', 'selectedNodeData'),
     State('selected-nodes', 'data'),
     State('petri-net-log', 'data')],
    prevent_initial_call=True
)
def set_special_nodes(set_start, set_end, selected_node_data, current_selected_nodes, log_data):
    if not ctx.triggered or not selected_node_data or not selected_node_data[0]:
        return no_update, no_update
    
    trigger_id = ctx.triggered[0]['prop_id'].split('.')[0]
    node_id = selected_node_data[0]['id']
    updated_selected = current_selected_nodes.copy() if current_selected_nodes else {'start': None, 'end': None}
    updated_log = log_data.copy()
    
    if trigger_id == 'set-start-node-btn':
        updated_selected['start'] = node_id
        updated_log.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'action': 'Set start node',
            'details': f"Node {node_id} set as start"
        })
    
    elif trigger_id == 'set-end-node-btn':
        updated_selected['end'] = node_id
        updated_log.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'action': 'Set end node',
            'details': f"Node {node_id} set as end"
        })
    
    return updated_selected, updated_log

@callback(
    Output('cytoscape-elements', 'data', allow_duplicate=True),
    Output('petri-net-log', 'data', allow_duplicate=True),
    [Input('connection-mode', 'value')],
    [State('cytoscape-petri', 'selectedNodeData'),
     State('cytoscape-elements', 'data'),
     State('petri-net-log', 'data')],
    prevent_initial_call=True
)
def handle_connection_mode(connection_mode, selected_nodes, elements, log_data):
    if connection_mode != 'connect' or not selected_nodes or len(selected_nodes) != 2:
        return no_update, no_update
    
    source_id = selected_nodes[0]['id']
    target_id = selected_nodes[1]['id']
    source_type = selected_nodes[0].get('type')
    target_type = selected_nodes[1].get('type')
    
    # Check if the connection makes sense (place -> transition or transition -> place)
    if (source_type == 'place' and target_type == 'transition') or (source_type == 'transition' and target_type == 'place'):
        updated_elements = elements.copy()
        updated_log = log_data.copy()
        
        # Check if edge already exists
        edge_exists = False
        for element in updated_elements:
            if 'data' in element and 'source' in element['data'] and element['data']['source'] == source_id and element['data']['target'] == target_id:
                edge_exists = True
                break
        
        if not edge_exists:
            new_edge = create_edge(source_id, target_id)
            updated_elements.append(new_edge)
            updated_log.append({
                'timestamp': datetime.now().strftime('%H:%M:%S'),
                'action': 'Created connection',
                'details': f"Edge from {source_id} to {target_id} created"
            })
            
            return updated_elements, updated_log
    
    return no_update, no_update

@callback(
    Output('simulation-state', 'data'),
    Output('cytoscape-elements', 'data', allow_duplicate=True),
    Output('petri-net-log', 'data', allow_duplicate=True),
    [Input('run-simulation-btn', 'n_clicks'),
     Input('stop-simulation-btn', 'n_clicks')],
    [State('simulation-state', 'data'),
     State('cytoscape-elements', 'data'),
     State('petri-net-log', 'data')],
    prevent_initial_call=True
)
def handle_simulation(run_sim, stop_sim, sim_state, elements, log_data):
    if not ctx.triggered:
        return no_update, no_update, no_update
    
    trigger_id = ctx.triggered[0]['prop_id'].split('.')[0]
    updated_sim_state = sim_state.copy() if sim_state else {'running': False, 'steps': 0}
    updated_elements = elements.copy()
    updated_log = log_data.copy()
    
    if trigger_id == 'run-simulation-btn':
        # Start/continue simulation
        updated_sim_state['running'] = True
        
        # Initialize simulation path
        simulation_path = []
        
        # Run one step of simulation
        updated_elements, simulation_path, success = run_simulation_step(updated_elements, simulation_path)
        if success:
            updated_sim_state['steps'] += 1
            updated_log.append({
                'timestamp': datetime.now().strftime('%H:%M:%S'),
                'action': 'Simulation step',
                'details': f"Step {updated_sim_state['steps']} executed"
            })
            
            # Apply visual effect for simulation path
            updated_elements = apply_simulation_path_classes(updated_elements, simulation_path)
        else:
            updated_log.append({
                'timestamp': datetime.now().strftime('%H:%M:%S'),
                'action': 'Simulation stopped',
                'details': "No more enabled transitions"
            })
            updated_sim_state['running'] = False
    
    elif trigger_id == 'stop-simulation-btn':
        # Stop simulation
        updated_sim_state['running'] = False
        updated_sim_state['steps'] = 0
        updated_log.append({
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'action': 'Simulation stopped',
            'details': "Simulation manually stopped"
        })
        
        # Remove simulation path visual effects
        updated_elements = reset_simulation_paths(updated_elements)
    
    return updated_sim_state, updated_elements, updated_log

@callback(
    Output('token-counter', 'children'),
    [Input('cytoscape-elements', 'data')]
)
def update_token_counter(elements):
    total_tokens = count_tokens(elements)
    return f"Total Tokens: {total_tokens}"

@callback(
    Output('simulation-log-table', 'children'),
    [Input('petri-net-log', 'data')]
)
def update_log_table(log_data):
    if not log_data:
        return html.Div("No logs yet")
    
    # Convert log data to DataFrame for easier manipulation
    df = pd.DataFrame(log_data)
    
    # Create table rows
    rows = []
    for index, row in df.iterrows():
        rows.append(
            html.Tr([
                html.Td(row['timestamp'], style={'padding': '5px', 'borderBottom': '1px solid #eee'}),
                html.Td(row['action'], style={'padding': '5px', 'borderBottom': '1px solid #eee'}),
                html.Td(row['details'], style={'padding': '5px', 'borderBottom': '1px solid #eee'})
            ])
        )
    
    return html.Table(
        [
            html.Thead(
                html.Tr([
                    html.Th("Time", style={'padding': '8px', 'textAlign': 'left', 'backgroundColor': '#f2f2f2', 'fontWeight': 'bold'}),
                    html.Th("Action", style={'padding': '8px', 'textAlign': 'left', 'backgroundColor': '#f2f2f2', 'fontWeight': 'bold'}),
                    html.Th("Details", style={'padding': '8px', 'textAlign': 'left', 'backgroundColor': '#f2f2f2', 'fontWeight': 'bold'})
                ])
            ),
            html.Tbody(rows)
        ],
        style={'width': '100%', 'borderCollapse': 'collapse'}
    )


# Run the app
if __name__ == '__main__':
    app.run_server(debug=True, port=8050)
