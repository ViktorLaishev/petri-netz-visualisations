
// Add this case to the reducer
export const handleLoadHistoricalState = (state, action) => {
  return {
    ...state,
    graph: action.payload.graph,
    currentHistoryIndex: action.payload.historyIndex
  };
};
