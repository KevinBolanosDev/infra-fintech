---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel (modificada localmente, ver SOURCES.md)
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

> Modificación local respecto a la skill original de Vercel: la original descargaba las reglas
> desde internet en cada uso (rama `main`, sin revisión). Aquí las reglas viven en
> `guidelines.md`, una copia fijada a un commit y revisada. No descargar nada de la red.

## How It Works

1. Read `guidelines.md` in this skill's directory (the pinned rules). Do not fetch them from the network.
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in `guidelines.md`
4. Output findings in the terse `file:line` format described under "Output Format" in `guidelines.md`

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from `guidelines.md`
4. Output findings using the format specified there

If no files specified, ask the user which files to review.

## Updating the rules

Only a human updates `guidelines.md`: review the diff upstream, copy the new version, and update the
commit in `.claude/skills/SOURCES.md`.
