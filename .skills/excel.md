# Excel Generation Skill (Local)

Use this skill to create an Excel (.xlsx) spreadsheet.

## Instructions
1. Plan the sheets, column headers, and data rows.
2. Trigger the skill using the following tag:
<CALL_SKILL name="excel">{"title": "Workbook Title", "sheets": [{"name": "SheetName", "columns": [{"header": "Col1"}, {"header": "Col2"}], "rows": [["val1", "val2"], ["val3", "val4"]]}]}</CALL_SKILL>
