# PPT Generation Skill (Local)

Use this skill when the user asks to create a PowerPoint, slides, or a presentation.

## Instructions
1. Analyze the project context and user request.
2. Plan a logical sequence of slides (Intro, Methods, Results, Conclusion, etc.).
3. For each slide, provide a "title" and "content" (which can be a string or an array of bullet points).
4. Trigger the skill using the following tag:
<CALL_SKILL name="ppt">{"slides": [{"title": "Slide Title", "content": ["Bullet 1", "Bullet 2"]}]}</CALL_SKILL>

## Example
User: "Make 3 slides about my experiment."
AI: "I'll create the slides for you. <CALL_SKILL name="ppt">{"slides": [{"title": "Introduction", "content": "Overview of experiment..."}, {"title": "Methodology", "content": ["Step 1", "Step 2"]}, {"title": "Initial Results", "content": "Observed data points..."}]}</CALL_SKILL>"
