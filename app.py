import dash
from dash import html, dcc, Output, Input, State, callback_context, dash_table
import dash_cytoscape as cyto
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

# Rule implementations
def abstraction_rule(G, t):
    p_new = f"P{len([n for n,d in G.nodes(data=True) if d['type']=='place'])}"
    G.add_node(p_new, type='place', tokens=0)
    t_new = f"T{len([n for n,d in G.nodes(data=True) if d['type']=='transition'])}"
    G.add_node(t_new, type='transition')
    outputs = list(G.successors(t))
    for o in outputs:
        G.remove_edge(t, o)
        G.add_edge(t_new, o)
    G.add_edge(t, p_new)
    G.add_edge(p_new, t_new)
    return G

def linear_transition_rule(G, p):
    t_new = f"T{len([n for n,d in G.nodes(data=True) if d['type']=='transition'])}"
    G.add_node(t_new, type='transition')
    G.add_edge(p, t_new)
    succ_trans = [v for u,v in G.out_edges(p) if G.nodes[v]['type']=='transition']
    output_places = set()
    for t in succ_trans:
        output_places.update([w for _,w in G.out_edges(t) if G.nodes[w]['type']=='place'])
    for op in output_places:
        G.add_edge(t_new, op)
    return G

def linear_place_rule(G, t):
    p_new = f"P{len([n for n,d in G.nodes(data=True) if d['type']=='place'])}"
    G.add_node(p_new, type='place', tokens=0)
    inputs = [u for u,_ in G.in_edges(t) if G.nodes[u]['type']=='place']
    for ip in inputs:
        G.remove_edge(ip, t)
        G.add_edge(ip, p_new)
    G.add_edge(p_new, t)
    return G

def dual_abstraction_rule(G, t):
    G = abstraction_rule(G, t)
    new_place = [n for n,d in G.nodes(data=True) if d['type']=='place'][-1]
    G = linear_transition_rule(G, new_place)
    return G

rules_map = {
    'Abstraction ψA': (abstraction_rule, 'transition'),
    'Linear Transition ψT': (linear_transition_rule, 'place'),
    'Linear Place ψP': (linear_place_rule, 'transition'),
    'Dual Abstraction ψD': (dual_abstraction_rule, 'transition'),
}

# -------------------------
# Dash App
# -------------------------
app = dash.Dash(__name__)
app.title = 'Petri‑Net Manager'

app.layout = html.Div([
    dcc.Store(id='net-store', data={'G': nx.node_link_data(init_petri_net()), 'log': [], 'history': []}),
    html.Div([
        html.Div([
            html.H4("Controls"),
            html.Button("Undo Last", id='undo-btn', style={'width':'100%'}),
            html.Button("Reset to Default", id='reset-btn', style={'width':'100%', 'marginTop':'5px'}),
            html.H5("Add Node", style={'marginTop':'15px'}),
            dcc.Input(id='new-place', placeholder='Place name', style={'width':'100%'}),
            html.Button("Add Place", id='add-place', style={'width':'100%', 'marginTop':'5px'}),
            dcc.Input(id='new-trans', placeholder='Transition name', style={'width':'100%', 'marginTop':'10px'}),
            html.Button("Add Transition", id='add-trans', style={'width':'100%', 'marginTop':'5px'}),
            html.H5("Connect", style={'marginTop':'15px'}),
            dcc.Dropdown(id='from-node', placeholder='From', style={'width':'100%'}),
            dcc.Dropdown(id='to-node', placeholder='To', style={'width':'100%', 'marginTop':'5px'}),
            html.Button("Connect", id='connect-btn', style={'width':'100%', 'marginTop':'5px'}),
            html.H5("Apply Rule", style={'marginTop':'15px'}),
            dcc.Dropdown(id='rule-select', options=[{'label':k,'value':k} for k in rules_map], placeholder='Rule'),
            dcc.Dropdown(id='target-select', placeholder='Target node', style={'marginTop':'5px'}),
            html.Button("Apply Rule", id='apply-rule', style={'width':'100%', 'marginTop':'5px'}),
            html.Button("Apply Random Rule", id='apply-random', style={'width':'100%', 'marginTop':'5px'}),
            html.H5("Batch Generation", style={'marginTop':'15px'}),
            dcc.Input(id='batch-count', type='number', placeholder='Number of rules', value=1, style={'width':'100%'}),
            dcc.Checklist(id='batch-random', options=[{'label':' Use random rules','value':'random'}], value=['random']),
            dcc.Dropdown(id='batch-rules', options=[{'label':k,'value':k} for k in rules_map], multi=True, placeholder='Select rules'),
            html.Button("Generate", id='generate-btn', style={'width':'100%', 'marginTop':'5px'}),
            html.H5("Token Flow", style={'marginTop':'15px'}),
            dcc.Dropdown(id='start-node', placeholder='Start Place', style={'width':'100%'}),
            dcc.Dropdown(id='end-node', placeholder='End Place', style={'width':'100%', 'marginTop':'5px'}),
            html.Button("Set Token Flow", id='set-flow', style={'width':'100%', 'marginTop':'5px'}),
            html.Button("Center Graph", id='center-btn', style={'width':'100%', 'marginTop':'5px'}),
        ], style={'width':'25%', 'display':'inline-block', 'padding':'10px'}),
        html.Div([
            html.H4("Petri‑Net Visualization"),
            cyto.Cytoscape(
                id='petri-net',
                style={'width':'100%', 'height':'600px'},
                layout={'name':'breadthfirst'},
                stylesheet=[
                    {'selector':'.place','style':{'shape':'ellipse','background-color':'skyblue','content':'data(label)','text-valign':'center','text-halign':'center','font-size':'12px'}},
                    {'selector':'.transition','style':{'shape':'rectangle','background-color':'lightgreen','content':'data(label)','text-valign':'center','text-halign':'center','font-size':'12px'}},
                    {'selector':'edge','style':{'curve-style':'bezier','target-arrow-shape':'triangle','arrow-scale':1}}
                ],
                zoom=1, pan={'x':0,'y':0}
            )
        ], style={'width':'70%', 'display':'inline-block', 'padding':'10px'}),
    ], style={'display':'flex'}),
    html.H4("Process Log"),
    dash_table.DataTable(
        id='log-table',
        columns=[{'name':'ID','id':'id'},{'name':'Timestamp','id':'timestamp'},{'name':'Action','id':'action'}],
        style_table={'height':'200px','overflowY':'auto'},
        style_cell={'textAlign':'left','padding':'5px'},
        style_header={'backgroundColor':'lightgrey','fontWeight':'bold'}
    ),
    html.Button('Download Log CSV', id='download-log-btn', style={'marginTop':'10px'}),
    dcc.Download(id='download-log'),
    html.H4("Token Counts"),
    dcc.Markdown(id='token-md'),
])

# -------------------------
# Callbacks and Helpers
# -------------------------

def push_history(data):
    data['history'].append((copy.deepcopy(data['G']), data['log'].copy()))

def record_action(data, action):
    entry = {'id': len(data['log']) + 1,
             'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
             'action': action}
    data['log'].append(entry)

@app.callback(
    Output('start-node','options'),
    Output('end-node','options'),
    Input('net-store','data')
)
def update_start_end(data):
    G = nx.node_link_graph(data['G'])
    places = [{'label':n,'value':n} for n,d in G.nodes(data=True) if d['type']=='place']
    return places, places

@app.callback(
    Output('target-select','options'),
    Output('target-select','value'),
    Input('rule-select','value'),
    State('net-store','data')
)
def update_target_options(selected_rule, data):
    if not selected_rule: return [], None
    G = nx.node_link_graph(data['G'])
    _, node_type = rules_map[selected_rule]
    opts = [{'label':n,'value':n} for n,d in G.nodes(data=True) if d['type']==node_type]
    return opts, None

@app.callback(
    Output('net-store','data'),
    Output('from-node','options'),
    Output('to-node','options'),
    Input('undo-btn','n_clicks'),
    Input('reset-btn','n_clicks'),
    Input('add-place','n_clicks'),
    Input('add-trans','n_clicks'),
    Input('connect-btn','n_clicks'),
    Input('apply-rule','n_clicks'),
    Input('apply-random','n_clicks'),
    Input('generate-btn','n_clicks'),
    Input('set-flow','n_clicks'),
    Input('center-btn','n_clicks'),
    State('batch-count','value'),
    State('batch-random','value'),
    State('batch-rules','value'),
    State('new-place','value'),
    State('new-trans','value'),
    State('from-node','value'),
    State('to-node','value'),
    State('rule-select','value'),
    State('target-select','value'),
    State('start-node','value'),
    State('end-node','value'),
    State('net-store','data'),
)
def update_net(undo, reset, addp, addt, conn, applyr, applyrand, gen, setflow, center,
               count, brandom, brules,
               new_place, new_trans, frm, to, rule, target, start, end, data):
    ctx = callback_context
    G = nx.node_link_graph(data['G'])
    btn = ctx.triggered[0]['prop_id'].split('.')[0]
    if btn=='undo-btn':
        if data['history']:
            g_prev, log_prev = data['history'].pop()
            data['G'], data['log'] = g_prev, log_prev
        return data, [{'label':n,'value':n} for n in G.nodes], [{'label':n,'value':n} for n in G.nodes]
    if btn=='reset-btn':
        push_history(data)
        G = init_petri_net()
        data['G'], data['log'] = nx.node_link_data(G), []
        record_action(data,'Reset to default')
        return data, [{'label':n,'value':n} for n in G.nodes], [{'label':n,'value':n} for n in G.nodes]
    if btn=='add-place' and new_place:
        push_history(data)
        G.add_node(new_place, type='place', tokens=0)
        data['G'] = nx.node_link_data(G); record_action(data,f"Added place {new_place}")
    if btn=='add-trans' and new_trans:
        push_history(data)
        G.add_node(new_trans, type='transition')
        data['G'] = nx.node_link_data(G); record_action(data,f"Added transition {new_trans}")
    if btn=='connect-btn' and frm and to:
        push_history(data)
        G.add_edge(frm, to)
        data['G'] = nx.node_link_data(G); record_action(data,f"Connected {frm}->{to}")
    if btn=='apply-rule' and rule and target:
        push_history(data)
        fn,_=rules_map[rule]; G=fn(G,target)
        data['G']=nx.node_link_data(G); record_action(data,f"Applied {rule} on {target}")
    if btn=='apply-random':
        rule_rand = random.choice(list(rules_map.keys()))
        fn,nt=rules_map[rule_rand]
        cands=[n for n,d in G.nodes(data=True) if d['type']==nt]
        if cands:
            tgt=random.choice(cands)
            push_history(data)
            G=fn(G,tgt); data['G']=nx.node_link_data(G)
            record_action(data,f"Random {rule_rand} on {tgt}")
    if btn=='generate-btn':
        push_history(data)
        for i in range(count or 1):
            if 'random' in (brandom or []):
                # random rule and target
                rule_rand = random.choice(list(rules_map.keys()))
                fn,nt=rules_map[rule_rand]
                cands=[n for n,d in G.nodes(data=True) if d['type']==nt]
                if cands:
                    tgt=random.choice(cands)
                    G=fn(G,tgt)
                    record_action(data,f"Batch random {rule_rand} on {tgt}")
            else:
                # specific rules
                for rule_sel in (brules or []):
                    fn,nt=rules_map[rule_sel]
                    cands=[n for n,d in G.nodes(data=True) if d['type']==nt]
                    if cands:
                        tgt=random.choice(cands)
                        G=fn(G,tgt)
                        record_action(data,f"Batch {rule_sel} on {tgt}")
        data['G']=nx.node_link_data(G)
    if btn=='set-flow' and start and end:
        push_history(data)
        for n,d in G.nodes(data=True):
            if d['type']=='place': G.nodes[n]['tokens']=0
        G.nodes[start]['tokens']=1
        data['G']=nx.node_link_data(G)
        record_action(data,f"Flow start={start},end={end}")
    return data, [{'label':n,'value':n} for n in G.nodes], [{'label':n,'value':n} for n in G.nodes]

@app.callback(
    Output('petri-net','elements'),
    Input('net-store','data')
)
def render_graph(data):
    G=nx.node_link_graph(data['G']); elems=[]
    for n,d in G.nodes(data=True): elems.append({'data':{'id':n,'label':n,'tokens':d.get('tokens',0)},'classes':d['type']})
    for u,v in G.edges(): elems.append({'data':{'source':u,'target':v}})
    return elems

@app.callback(
    Output('log-table','data'),
    Output('token-md','children'),
    Input('net-store','data')
)
def render_log_and_tokens(data):
    df=pd.DataFrame(data['log'])
    G=nx.node_link_graph(data['G'])
    tokens={n:d['tokens'] for n,d in G.nodes(data=True) if d['type']=='place'}
    token_md='\n'.join(f"- **{p}**: {tok}" for p,tok in tokens.items())
    return df.to_dict('records'), token_md

@app.callback(
    Output('download-log','data'),
    Input('download-log-btn','n_clicks'),
    State('net-store','data'),
    prevent_initial_call=True
)
def download_log(n,data):
    df=pd.DataFrame(data['log'])
    return dcc.send_data_frame(df.to_csv,'process_log.csv',index=False)

@app.callback(
    Output('petri-net','zoom'),
    Output('petri-net','pan'),
    Input('center-btn','n_clicks'),
    prevent_initial_call=True
)
def center_graph(n):
    return 1,{'x':0,'y':0}

if __name__=='__main__':
    app.run_server(debug=True)

