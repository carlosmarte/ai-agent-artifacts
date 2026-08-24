### 1. Frameworks & Argument Parsers

These handle the core architecture, routing, and flag parsing.

- **Cobra**: The undisputed titan of Go CLI frameworks. It powers Kubernetes (`kubectl`), Hugo, and the GitHub CLI. It provides routing, auto-generated help, shell completions, and nested subcommands.
- **urfave/cli**: A classic, highly popular, and slightly cleaner alternative to Cobra for applications that don't need massive, deeply nested command trees.
- **Kong**: A modern, struct-driven parser. You define your CLI flags and commands using standard Go struct tags, making your command-line API highly declarative and type-safe.
- **Bubble Tea**: The Go standard for building highly interactive Terminal User Interfaces (TUIs). Built by Charmbracelet, it uses the Elm architecture to create reactive, state-driven terminal applications (analogous to Node's Ink or Python's Textual).

### 2. Interactive Prompts

When you need to stop and ask the user for text input, passwords, or list selections.

- **Huh?**: A modern, highly accessible library for building terminal forms and prompts. Created by the Charmbracelet team, it is the modern successor to older prompt libraries and integrates seamlessly with Bubble Tea.
- **Survey** (`AlecAivazis/survey`): The classic Go port of Inquirer.js. It provides robust, battle-tested support for checkboxes, multiselects, and validation.
- **Promptui**: A lightweight library providing simple, interactive prompts and selectable lists with built-in search and pagination.

### 3. Styling & Visual Feedback

Terminal styling, progress bars, spinners, and structured visual layouts.

- **Lip Gloss**: The standard for modern terminal styling in Go (also by Charmbracelet). It allows you to style terminal text using a CSS-like API (margins, padding, borders, colors), acting as the modern equivalent to Chalk and Boxen combined.
- **Bubbles**: The companion library to Bubble Tea and Lip Gloss, providing ready-made UI components like spinners, progress bars, and paginators.
- **Fatih/color**: The classic, lightweight library for basic cross-platform ANSI colored text output.
- **Glamour**: A specialized library for rendering beautiful, styled Markdown directly in the terminal.

### 4. Configuration & Execution

Tools to handle underlying operating system commands and user settings.

- **Viper**: The industry heavyweight for configuration in Go      . It handles file discovery natively and can load and merge configurations from JSON, TOML, YAML, HCL, INI, environment variables, command-line flags, and even live remote key-value stores      .
- **Koanf**: A modern, lighter alternative to Viper that provides the same hierarchical merging of different file formats, but is built strictly without global state      .
- **Godotenv**: The absolute baseline for managing local secrets, reading `.env` files and pushing them into system environment variables      .
- **Cleanenv / Envconfig**: Strict validators that safely cast environment variables or config files directly into Go structs, panicking immediately if a required variable is missing or typed incorrectly      .
- **Native `os/exec`**: Unlike Node or Python, Go doesn't rely heavily on third-party execution libraries (like Execa or sh). Go's standard library `os/exec` is incredibly robust, cross-platform, and is the industry standard for safely executing shell commands and child processes.
