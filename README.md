
# Petri Net Flow Visualizer

A React-based interactive web application for visualizing and simulating Petri nets with token flows.

## Project Overview

This project is a visualization tool for Petri nets that allows users to:
- Create places and transitions
- Connect nodes to form a Petri net graph
- Apply various transformation rules to the graph
- Simulate token flow through the network
- Generate logs of all operations

The application is built using modern web technologies and provides an intuitive interface for working with Petri net models.

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

### Python Implementation

The repository also includes `petri_net_app.py`, which is an alternative implementation of the Petri net visualizer using Python with Dash and dash-cytoscape. This is separate from the React implementation and can be run independently.

## Key Features

### Node Creation and Management

- Add places (circular nodes)
- Add transitions (rectangular nodes)
- Connect nodes with directed edges
- Add/remove tokens from places

### Transformation Rules

- **Abstraction ψA** - Replaces a direct connection with an intermediate place and transition
- **Linear Transition ψT** - Creates a new transition from a place
- **Linear Place ψP** - Creates a new place leading to a transition
- **Dual Abstraction ψD** - Combines abstraction with linear transition

### Simulation

- Set token flow start and end points
- Animate token movement through the Petri net
- View process logs of token movement
- Track token counts in different places

### Batch Operations

- Apply multiple rules at once
- Choose specific rules or use random selection
- Generate complex Petri nets quickly

## UI Layout

The user interface is divided into several key areas:

1. **Left Panel (Control Panel)**
   - Tabs for different operations (Nodes, Rules, Flow, Batch)
   - Controls for adding nodes, applying rules, setting token flow, and batch operations
   - Undo and reset buttons

2. **Main Graph View**
   - Interactive visualization of the Petri net
   - Controls for starting/stopping simulation and centering the graph

3. **Bottom Panel**
   - Process log table showing operation history
   - Token counter displaying the number of tokens in each place

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## Development Guidelines

### Adding New Components

1. Create a new component in the appropriate directory
2. For UI components, consider using shadcn/ui as a foundation
3. Import the component where needed

### Modifying Petri Net Logic

The core logic for Petri net operations is in `src/contexts/PetriNetContext.tsx`. This includes:

- Node and edge management
- Rule implementations
- Simulation logic
- History tracking

### Styling Components

The project uses Tailwind CSS for styling. To add or modify styles:

1. Use Tailwind utility classes directly in the component
2. For complex components, consider creating a dedicated CSS file
3. Global styles can be added to `src/index.css`

## Python Implementation

The `petri_net_app.py` file contains a Python implementation using Dash and dash-cytoscape. To run it:

1. Install required Python packages:
   ```
   pip install dash dash-cytoscape pandas networkx
   ```

2. Run the application:
   ```
   python petri_net_app.py
   ```

This will start a web server, and you can access the application by navigating to the URL shown in the terminal (typically `http://127.0.0.1:8050`).
