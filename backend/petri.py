# backend/petri.py

import pm4py
import numpy as np
import copy, random
from itertools import product, combinations
from datetime import datetime

from pm4py.objects.petri_net.utils import incidence_matrix
from pm4py.algo.analysis.woflan import algorithm as woflan
from pm4py.objects.petri_net.obj import PetriNet, Marking
from pm4py.objects.petri_net.utils.petri_utils import add_arc_from_to, get_transition_by_name

# -- Module state -------------------------------------------------------

_current_matrix = None    # incidence matrix (np.array)
_current_net    = None    # pm4py PetriNet
_current_im     = None    # initial marking
_current_fm     = None    # final marking
_log            = []      # action log: list of {id, ts, action}
_undo_stack     = []      # list of snapshots: (matrix, net, im, fm, log_copy)

class UndoEmpty(Exception):
    """Raised when there is no more history to undo."""
    pass

# -- Core API -----------------------------------------------------------

def reset_history():
    """Clear the net, log, and undo stack."""
    global _current_matrix, _current_net, _current_im, _current_fm, _log, _undo_stack
    _current_matrix = None
    _current_net    = None
    _current_im     = None
    _current_fm     = None
    _log.clear()
    _undo_stack.clear()

def init_net(num_places: int, num_transitions: int) -> str:
    """
    Initialize a simple linear workflow net with the given numbers.
    Returns a dummy net_id.
    """
    global _current_matrix, _current_net, _current_im, _current_fm, _log

    # Build a simple chain incidence matrix: p0 -t0-> p1 -t1-> ... 
    mat = np.zeros((num_places, num_transitions), dtype=int)
    for i in range(num_transitions):
        mat[i,   i] = -1
        mat[i+1, i] =  1
    _current_matrix = mat

    # Convert to a PetriNet + markings
    d = create_pn_from_incidence_mat(mat, return_net_dict=True)
    _current_net, _current_im, _current_fm = d["petri"], d["im"], d["fm"]

    # Log the action
    entry = {
      "id": len(_log) + 1,
      "ts": datetime.utcnow().isoformat() + "Z",
      "action": f"init({num_places},{num_transitions})"
    }
    _log.append(entry)

    return "net1"

def apply_rule(rule_name: str, target1: str=None, target2: str=None):
    """
    Apply one of the four synthesis rules: psiA, psiT, psiP, psiD.
    """
    global _current_matrix, _current_net, _current_im, _current_fm, _log, _undo_stack

    if _current_matrix is None:
        raise RuntimeError("No net initialized")

    # Snapshot for undo
    _undo_stack.append((
      _current_matrix.copy(),
      copy.deepcopy(_current_net),
      copy.deepcopy(_current_im),
      copy.deepcopy(_current_fm),
      list(_log)
    ))

    # Dispatch
    if rule_name == "psiA":
        rows, cols = find_connected_cells(_current_matrix, target_value=-1)
        _current_matrix = apply_abs_rule(_current_matrix, rows, cols)
    elif rule_name == "psiT":
        _current_matrix = add_column(_current_matrix)
    elif rule_name == "psiP":
        _current_matrix = add_row(_current_matrix)
    elif rule_name == "psiD":
        rows, cols = find_connected_cells(_current_matrix, target_value=1)
        _current_matrix = apply_dual_abs_rule(_current_matrix, rows, cols)
    else:
        raise ValueError(f"Unknown rule {rule_name}")

    # Rebuild the net & markings
    d = create_pn_from_incidence_mat(_current_matrix, return_net_dict=True)
    _current_net, _current_im, _current_fm = d["petri"], d["im"], d["fm"]

    # Log it
    entry = {
      "id": len(_log) + 1,
      "ts": datetime.utcnow().isoformat() + "Z",
      "action": f"{rule_name}({target_id or 'auto'})"
    }
    _log.append(entry)

def push_undo_snapshot():
    """No-op: we snapshot inside apply_rule."""
    pass

def pop_undo_snapshot():
    """Restore the previous state or raise UndoEmpty."""
    global _current_matrix, _current_net, _current_im, _current_fm, _log, _undo_stack
    if not _undo_stack:
        raise UndoEmpty()
    m, net, im, fm, lg = _undo_stack.pop()
    _current_matrix, _current_net, _current_im, _current_fm, _log = m, net, im, fm, lg

def serialize_graph():
    """
    Serialize the current net into JSON-friendly nodes & edges.
    """
    nodes, edges = [], []
    for p in _current_net.places:
        nodes.append({
          "id": p.name,
          "type": "place",
          "tokens": int(_current_im.get(p, 0))
        })
    for t in _current_net.transitions:
        nodes.append({ "id": t.name, "type": "transition" })
    for arc in _current_net.arcs:
        edges.append({ "source": arc.source.name, "target": arc.target.name })
    return { "nodes": nodes, "edges": edges }

def get_log():
    """Return the action log."""
    return _log

# ----------------------------------------------------------------------
# All of your helper logic, straight from the notebook:
# ----------------------------------------------------------------------

def remove_tran_by_name(net, trans_name='short_circuited_transition'):
    import copy
    from pm4py.objects.petri_net.utils.petri_utils import get_transition_by_name
    new_net = copy.deepcopy(net)
    trans = get_transition_by_name(new_net, trans_name)
    if trans in new_net.transitions:
        for arc in list(trans.in_arcs):
            place = arc.source
            place.out_arcs.remove(arc)
            new_net.arcs.remove(arc)
        for arc in list(trans.out_arcs):
            place = arc.target
            place.in_arcs.remove(arc)
            new_net.arcs.remove(arc)
        new_net.transitions.remove(trans)
    return new_net

def create_pn_from_incidence_mat(incidence_mat, places_dict=None, trans_dict=None, return_net_dict=False):
    from pm4py.objects.petri_net.obj import PetriNet, Marking
    from pm4py.objects.petri_net.utils.petri_utils import add_arc_from_to
    import numpy as np
    import copy
    net = PetriNet("new_petri_net")
    # Check workflow‐net structure
    is_wfn = (np.sum(np.all(incidence_mat <= 0, axis=1)) == 1
           and np.sum(np.all(incidence_mat >= 0, axis=1)) == 1)
    # Transitions
    if trans_dict is None:
        trans_dict = {f"t{i}": i for i in range(incidence_mat.shape[1])}
    label_trans = {}
    for name, idx in trans_dict.items():
        label_trans[name] = PetriNet.Transition(name, None if "tau" in name else name)
        net.transitions.add(label_trans[name])
    # Places
    if places_dict is None:
        places_dict = {f"p{i}": i for i in range(incidence_mat.shape[0])}
    place_objs = {}
    for name in places_dict:
        place_objs[name] = PetriNet.Place(name)
        net.places.add(place_objs[name])
    # Arcs via incidence matrix
    for p_name, p_idx in places_dict.items():
        for t_name, t_idx in trans_dict.items():
            val = incidence_mat[p_idx, t_idx]
            if val == -1:
                add_arc_from_to(place_objs[p_name], label_trans[t_name], net)
            elif val == 1:
                add_arc_from_to(label_trans[t_name], place_objs[p_name], net)
    if return_net_dict:
        mat = incidence_matrix.construct(net)
        m = np.array(mat.a_matrix)
        src = np.where(np.all(m <= 0, axis=1))[0][0]
        sink = np.where(np.all(m >= 0, axis=1))[0][0]
        im = Marking({p: 1 for p in net.places if p.name == list(places_dict)[src]})
        fm = Marking({p: 1 for p in net.places if p.name == list(places_dict)[sink]})
        return {
          "petri": net,
          "incidence_mat": m,
          "places_dict": places_dict,
          "trans_dict": trans_dict,
          "im": im,
          "fm": fm
        }
    else:
        return net

def is_sound_from_mat_by_woflan(incidence_mat):
    net_dict = create_pn_from_incidence_mat(incidence_mat, return_net_dict=True)
    if 'im' not in net_dict or 'fm' not in net_dict:
        return False
    return woflan.apply(
      net=net_dict["petri"],
      i_m=net_dict["im"],
      f_m=net_dict["fm"],
      parameters={woflan.Parameters.RETURN_ASAP_WHEN_NOT_SOUND: True}
    )

def is_fc_net_from_mat(incidence_mat):
    n_trans = incidence_mat.shape[1]
    in_nodes = [np.where(incidence_mat[:, t] == -1)[0] for t in range(n_trans)]
    for t1, t2 in combinations(range(n_trans), 2):
        a, b = in_nodes[t1], in_nodes[t2]
        if not (np.array_equal(a,b) or len(np.intersect1d(a,b)) == 0):
            return False
    return True

def is_fc_net_after_addition(matrix, added="column"):
    rows, cols = matrix.shape
    if added == "column":
        new_t = cols-1
        new_in = np.where(matrix[:, new_t] == -1)[0]
        for t in range(cols-1):
            old = np.where(matrix[:, t] == -1)[0]
            if not (np.array_equal(new_in, old) or len(np.intersect1d(new_in, old)) == 0):
                return False
    else:  # row added
        new_p = rows-1
        aff = np.where(matrix[new_p, :] == -1)[0]
        for i in range(len(aff)):
            for j in range(i+1, len(aff)):
                t1, t2 = aff[i], aff[j]
                a = np.where(matrix[:, t1] == -1)[0]
                b = np.where(matrix[:, t2] == -1)[0]
                if not (np.array_equal(a,b) or len(np.intersect1d(a,b)) == 0):
                    return False
    return True

def is_valid_matrix(matrix):
    if not np.all(np.isin(matrix, [1,0,-1])): return False
    if np.any(np.all(matrix==0, axis=0)) or np.any(np.all(matrix==0, axis=1)): return False
    if np.sum(np.all((matrix==-1)|(matrix==0),axis=1))!=1: return False
    if np.sum(np.all((matrix==1)|(matrix==0),axis=1))!=1: return False
    if not np.all(np.any(matrix==1,axis=0) & np.any(matrix==-1,axis=0)): return False
    return True

def get_source_sink_indices(matrix):
    src = np.where(np.all((matrix==-1)|(matrix==0),axis=1))[0][0]
    snk = np.where(np.all((matrix==1)|(matrix==0),axis=1))[0][0]
    return src, snk

def generate_initial_matrix():
    mat = np.array([[1,0,1],[-1,1,0],[0,-1,-1]])
    assert is_valid_matrix(mat)
    return mat

def add_row(matrix, max_attempts=9999):
    num_rows, num_cols = matrix.shape
    existing = set(map(tuple, matrix))
    for _ in range(max_attempts):
        coeff = np.random.choice([-1,0,1], size=num_rows)
        new = np.sum(coeff[:,None]*matrix, axis=0)
        if validate_new_row(new, existing):
            cand = np.vstack([matrix,new])
            if validate_matrix(cand,'row'): return cand
    # fallback
    while True:
        for row in matrix[np.random.permutation(num_rows)]:
            if validate_new_row(row, existing):
                cand = np.vstack([matrix,row])
                if validate_matrix(cand,'row'): return cand

def add_column(matrix, max_attempts=9999):
    num_rows, num_cols = matrix.shape
    src, snk = get_source_sink_indices(matrix)
    for _ in range(max_attempts):
        coeff = np.random.choice([-1,0,1], size=num_cols)
        new = np.sum(coeff * matrix, axis=1)
        if validate_new_column(new, src, snk):
            cand = np.column_stack([matrix,new])
            if validate_matrix(cand,'column'): return cand
    while True:
        for col in matrix[:, np.random.permutation(num_cols)].T:
            if validate_new_column(col, src, snk):
                cand = np.column_stack([matrix,col])
                if validate_matrix(cand,'column'): return cand

def validate_new_row(new_row, existing_rows):
    return (
      np.all(np.isin(new_row,[1,0,-1])) and
      not np.all(new_row==0) and
      1 in new_row and -1 in new_row and
      tuple(-new_row) not in existing_rows
    )

def validate_new_column(new_col, src, snk):
    return (
      np.all(np.isin(new_col,[1,0,-1])) and
      not np.all(new_col==0) and
      1 in new_col and -1 in new_col and
      new_col[src] in (0,-1) and
      new_col[snk] in (0,1)
    )

def validate_matrix(mat, added):
    return (
      is_fc_net_after_addition(mat, added=added) and
      is_sound_from_mat_by_woflan(mat)
    )

def find_connected_cells(matrix, target_value=-1):
    rows = len(matrix)
    if rows==0: return [], []
    cols = len(matrix[0])
    arr = np.array(matrix)
    cells = [(r,c) for r in range(rows) for c in range(cols) if arr[r,c]==target_value]
    if not cells: return [], []
    if target_value==-1:
        _, uniq = np.unique(arr,axis=1,return_index=True)
        dup = set(range(cols))-set(uniq)
        if dup:
            c0 = random.choice(list(dup))
            cells = [(r,c) for r,c in cells if c==c0]
    else:
        _, uniq = np.unique(arr,axis=0,return_index=True)
        dup = set(range(rows))-set(uniq)
        if dup:
            r0 = random.choice(list(dup))
            cells = [(r,c) for r,c in cells if r==r0]
    # grow the region
    rs = {cells[0][0]}; cs = {cells[0][1]}
    changed=True
    while changed:
        changed=False
        for r in list(rs):
            for c in range(cols):
                if arr[r,c]==target_value and c not in cs:
                    cs.add(c); changed=True
        for c in list(cs):
            for r in range(rows):
                if arr[r,c]==target_value and r not in rs:
                    rs.add(r); changed=True
    return sorted(rs), sorted(cs)

def apply_abs_rule(mat, row_indices, col_indices, select_random_subset=True):
    from itertools import product
    if select_random_subset:
        row_indices = random.sample(row_indices, k=random.randint(1,len(row_indices)))
        col_indices = random.sample(col_indices, k=random.randint(1,len(col_indices)))
    new = mat.copy()
    for c,r in product(col_indices, row_indices):
        new[r,c] = 0
    # add place
    p_row = np.array([c in col_indices for c in range(new.shape[1])],int)
    new = np.vstack([new,p_row])
    # add transition
    t_col = np.array([r in row_indices for r in range(new.shape[0])],int)
    t_col[-1] = -1
    new = np.column_stack([new,t_col])
    return new

def apply_abs_rule_random(mat, select_random_subset=True):
    while True:
        rs, cs = find_connected_cells(mat, target_value=1)
        cand = apply_abs_rule(mat, rs, cs, select_random_subset)
        if is_sound_from_mat_by_woflan(cand): return cand

def apply_dual_abs_rule(mat, row_indices, col_indices, select_random_subset=True):
    if select_random_subset:
        keep = random.choice(["row","col"])
        if keep=="row" or len(col_indices)==1:
            col_indices = random.sample(col_indices, k=random.randint(1,len(col_indices)))
        else:
            row_indices = random.sample(row_indices, k=random.randint(1,len(row_indices)))
    new = mat.copy()
    for r,c in product(row_indices, col_indices):
        new[r,c] = 0
    # add transition
    t_col = -np.array([r in row_indices for r in range(new.shape[0])],int)
    new = np.column_stack([new,t_col])
    # add place
    p_row = -np.array([c in col_indices for c in range(new.shape[1])],int)
    p_row[-1] = 1
    new = np.vstack([new,p_row])
    return new

def apply_dual_abs_rule_random(mat, select_random_subset=True):
    while True:
        rs, cs = find_connected_cells(mat, target_value=-1)
        cand = apply_dual_abs_rule(mat, rs, cs, select_random_subset)
        if is_sound_from_mat_by_woflan(cand): return cand
