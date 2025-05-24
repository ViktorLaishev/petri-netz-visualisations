
# 📘 User Manual  
## Petri-Net Process Discovery Web Application

---

## 🔍 Overview

This web application provides an interactive, visual environment for **Petri net-based process discovery**, leveraging synthesis rules defined in academic research. It enables import/export of models, application of transformation rules, event log generation and analytics, and advanced interaction features for detailed process understanding.

---

## 🚀 Getting Started

### 🔧 Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Docker (for local deployment)

### 🐳 Running with Docker

```bash
git clone [https://github.com/your-username/petri-net-visualizer.git](https://github.com/ViktorLaishev/petri-netz-visualisations.git)
cd petri-net-visualizer
docker build -t petri-net-app .
docker run -p 3000:3000 petri-net-app
```

Then open `http://localhost:3000` in your browser.

---

## 🧠 Petri Nets & UI Basics

A **Petri Net** is a graphical and mathematical modeling tool for describing distributed systems. It consists of:
- **Places** (circles)
- **Transitions** (rectangles)
- **Tokens** (dots inside places)

### 🔹 Basic UI Actions

- **Undo**: Revert the last change.
- **Reset**: Reset the net to initial state.
- **Save**: Save the net for future use.
- **Center**: Center the net in the viewport.
- **Fullscreen**: View the net fullscreen.

---

## 🔄 Rule Application

### 🛠 How to Apply Rules

1. Select a rule from the dropdown.
2. Select the start node.
3. For certain rules (e.g. ψT, ψD), select an end node.
4. Click **Apply Rule**.

> If a rule is invalid, the system will **explain why** and show what rule it attempted.

### 📋 Available Rules

- **Abstraction (ψA)**: Simplifies by abstracting a transition and adjacent places.
- **Linear Transition (ψT)**: Adds a sequence of transitions.
- **Linear Place (ψP)**: Adds a linear sequence of places.
- **Dual Abstraction (ψD)**: Connects transitions with intermediate places.

### 🎲 Random & Weighted Application

- **Random**: Applies any valid rule.
- **Weighted Random**: Choose specific rules and assign weights to influence frequency.

---

## 🧾 Event Log

### 🔍 What It Does

Tracks all actions with:
- **Timestamps**
- **Action type**
- **State changes**
- **Details of affected nodes**

### 📈 Analytics Capabilities

- Transition frequency
- Trace length (avg, min, max)
- CSV export
- Rule frequency analysis
- Structural complexity changes

---

## 🔃 Batch Operations

1. Navigate to the **Batch** tab.
2. Set number of rule applications.
3. Select rules and assign weights (optional).
4. Click **Generate**.

Rules will be applied in bulk, preserving soundness.

---

## 🗃️ Saved Nets

Imported or saved models are stored under **Saved Nets**. You must load a saved model to edit or apply rules.

---

## 🧩 Interactive Graph Features

- **Double-click on places**:
  - Add/edit state descriptions
  - See incoming/outgoing transitions

- **Toggle light/dark mode** for visual preference

---

## 🧠 Tips

- Use **descriptions** to label places meaningfully.
- Rely on **event log** for process validation or auditing.
- When applying a rule fails, read the tooltip to understand the cause.

---

## 📚 Based On

- [Huang et al., 2022] Generating Flexible Process with Essential Properties
- PLG2, Process Mining tools
- Supervisor's backend logic

---

## ❓FAQ

**Q: A rule can’t be applied. Why?**  
A: The app prevents unsound transformations. A tooltip explains why the rule failed.

**Q: How do I share a model?**  
A: Use the **Export** feature to save the model as a `.pnml` file.

**Q: Where do I find old models?**  
A: In the **Saved Nets** section, then click "Load".

**Q: How does randomization work?**  
A: You can apply rules randomly or assign weights to control how often each rule appears.

---

## ✅ Summary

This app is a powerful educational and analytical tool for creating, modifying, and analyzing sound, free-choice Petri nets. It combines the rigor of academic research with an accessible and interactive UI for practical use in process mining, modeling, and simulation.

