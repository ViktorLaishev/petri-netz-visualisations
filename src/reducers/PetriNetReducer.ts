
// Add this case to the reducer
case 'LOAD_HISTORICAL_STATE':
  return {
    ...state,
    graph: action.payload.graph,
    currentHistoryIndex: action.payload.historyIndex
  };
