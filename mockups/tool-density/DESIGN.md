# Tool density mockup

- Goal: Explore a settings-driven compact transcript treatment for tool calls.
- Revision: 2
- Scope: One dark Pi Chat transcript with user/assistant messages, three sample tool calls, composer, and a Settings popover.
- Interaction: Settings opens from the toolbar. Comfortable shows tool details expanded with wider card spacing. Compact collapses tool details into small, muted, borderless background-text rows and reduces row height and surrounding transcript spacing. Tool rows remain expandable; expanded details use a subtle left guide instead of a card.
- Responsive behavior: Settings popover becomes near-full-width on narrow viewports; transcript and composer inset adapt.
- Fake/omitted: All content is static sample data; selection is in-memory only; no actual application state or persistence.
- Review status: approved for implementation by user after revision 2.
- Open question: Is the compact row summary and degree of spacing reduction right?
