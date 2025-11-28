import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AnalysisViewerProps 
{
    content: string;
}

interface Section 
{
    title: string;
    content: string;
    level: number;
}

function parseMarkdownSections(markdown: string): Section[] 
{
    const lines = markdown.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let currentContent: string[] = [];

    for (const line of lines) 
    {
        const h2Match = line.match(/^##\s+(.+)$/);
        const h1Match = line.match(/^#\s+(.+)$/);
        const boldMatch = line.match(/^\d+\.\s+\*\*(.+)\*\*$/);

        if (h1Match || h2Match || boldMatch) 
        {
            if (currentSection) 
            {
                currentSection.content = currentContent.join('\n').trim();
                sections.push(currentSection);
            }

            const title = h1Match?.[1] || h2Match?.[1] || boldMatch?.[1] || '';
            const level = h1Match ? 1 : 2;

            currentSection = 
            {
                title: title.replace(/\*\*/g, '').trim(),
                content: '',
                level
            };
            currentContent = [];
        } 
        else if (currentSection) 
        {
            currentContent.push(line);
        } 
        else 
        {
            currentContent.push(line);
        }
    }

    if (currentSection) 
    {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
    } 
    else if (currentContent.length > 0) 
    {
        sections.push({
            title: 'Análise',
            content: currentContent.join('\n').trim(),
            level: 1
        });
    }

    return sections;
}

function formatMarkdownContent(content: string): JSX.Element 
{
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let key = 0;

    const flushList = () => 
    {
        if (listItems.length > 0) 
        {
            elements.push(
                <ul key={`list-${key++}`} className="list-disc pl-6 space-y-1 my-2">
                    {listItems.map((item, idx) => (
                        <li key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
                    ))}
                </ul>
            );
            listItems = [];
        }
    };

    for (const line of lines) 
    {
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) 
        {
            listItems.push(line.trim().substring(1).trim());
        } 
        else 
        {
            flushList();
            if (line.trim()) 
            {
                elements.push(
                    <p key={`p-${key++}`} className="my-2" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
                );
            }
        }
    }

    flushList();
    return <div className="text-sm">{elements}</div>;
}

function formatInlineMarkdown(text: string): string 
{
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
}

export function AnalysisViewer({ content }: AnalysisViewerProps) 
{
    const sections = parseMarkdownSections(content);

    if (sections.length === 0) return <div className="text-muted-foreground">Nenhum conteúdo disponível</div>;

    const groupedSections: { main: Section; subsections: Section[] }[] = [];
    let currentGroup: { main: Section; subsections: Section[] } | null = null;

    for (const section of sections) 
    {
        if (section.level === 1) 
        {
            if (currentGroup) groupedSections.push(currentGroup);
            currentGroup = { main: section, subsections: [] };
        } 
        else if (currentGroup) 
        {
            currentGroup.subsections.push(section);
        } 
        else 
        {
            groupedSections.push({ main: section, subsections: [] });
        }
    }

    if (currentGroup) groupedSections.push(currentGroup);

    return (
        <div className="space-y-4">
            {groupedSections.map((group, groupIdx) => (
                <div key={groupIdx} className="border rounded-lg">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value={`main-${groupIdx}`} className="border-none">
                            <AccordionTrigger className="px-4 hover:no-underline">
                                <span className="font-semibold text-base">{group.main.title}</span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                {group.main.content && formatMarkdownContent(group.main.content)}

                                {group.subsections.length > 0 && (
                                    <Accordion type="multiple" className="mt-4">
                                        {group.subsections.map((subsection, subIdx) => (
                                            <AccordionItem key={subIdx} value={`sub-${groupIdx}-${subIdx}`}>
                                                <AccordionTrigger className="text-base font-semibold hover:no-underline">
                                                    {subsection.title}
                                                </AccordionTrigger>
                                                <AccordionContent className="pl-4">
                                                    {formatMarkdownContent(subsection.content)}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            ))}
        </div>
    );
}
