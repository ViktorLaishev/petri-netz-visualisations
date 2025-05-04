
# Petri Net Flow Visualizer

A React-based interactive web application for visualizing and simulating Petri nets with token flows.

## Project Overview

This project is a visualization tool for Petri nets that allows users to:
- Create places and transitions
- Connect nodes to form a Petri net graph
- Apply various transformation rules to the graph
- Simulate token flow through the network
- Generate logs of all operations


## Tech Stack

- **Frontend Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui library (based on Radix UI)
- **Graph Visualization**: Cytoscape.js
- **State Management**: React Context API
- **Build Tool**: Vite
- **Routing**: React Router

## Project Structure

### Core Files

- `src/main.tsx` - Application entry point
- `src/App.tsx` - Main application component with routing setup
- `src/index.css` - Global CSS styles

### Pages

- `src/pages/Index.tsx` - Main page with the Petri net interface (control panel, visualization area, log table, token counter)
- `src/pages/NotFound.tsx` - 404 page

### Components

- `src/components/PetriNetGraph.tsx` - Graph visualization component using Cytoscape.js
- `src/components/LogTable.tsx` - Table displaying operation logs
- `src/components/TokenCounter.tsx` - Component showing token counts in places

### State Management

- `src/contexts/PetriNetContext.tsx` - Context provider for Petri net state and operations:
  - Graph state (nodes, edges)
  - Token positioning and flow
  - Simulation state
  - Operation history and logs
  - Implementation of all Petri net operations and transformation rules

### UI Components

The project uses the shadcn/ui component library, which provides pre-built UI components:

- `src/components/ui/` - Contains all shadcn/ui components:
  - `button.tsx` - Button components
  - `card.tsx` - Card container components
  - `input.tsx` - Input field components
  - `select.tsx` - Dropdown select components
  - `tabs.tsx` - Tab navigation components
  - `toast.tsx` - Toast notification components
  - And many more utility UI components
