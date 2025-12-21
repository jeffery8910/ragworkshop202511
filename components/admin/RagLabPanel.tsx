'use client';

import { useMemo, useState } from 'react';
import { Search, Loader2, Database, MessageSquare, ArrowRight, Zap } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import { useToast } from '@/components/ui/ToastProvider';
import teachingDataset from '@/data/teaching-dataset.json';

interface RagResult {
    answer: string;
    context: Array<{
        score: number;
        text: string;
        source: string;
        page?: number;
        indexedAt?: number | string;
        metadata?: {
            text_length?: number;
            indexed_at?: number | string;
            chunk_id?: string;
            [key: string]: any;
        };
    }>;
    rewrittenQuery?: string;
    graphContext?: string;
    graphEvidence?: {
        nodes?: Array<{ id: string; label?: string; type?: string; docId?: string }>;
        edges?: Array<{ source: string; target: string; relation: string; docId?: string }>;
        triples?: string[];
    };
}

interface LabConfig {
    topK: number;
    rewrite: boolean;
    includeAnswer: boolean;
    useGraph: boolean;
}

interface TeachingDoc {
    id: string;
    filename: string;
    title: string;
    content: string;
}

interface TeachingQuestion {
    id: string;
    question: string;
    expected_terms: string[];
    expected_sources: string[];
}

interface TeachingDataset {
    id: string;
    name: string;
    description: string;
    docs: TeachingDoc[];
    questions: TeachingQuestion[];
}

interface EvalItem {
    id: string;
    question: string;
    termRecall: number;
    sourceRecall: number;
    hit: boolean;
    avgScore: number;
    topScore: number;
    chunkCount: number;
    graphNodes: number;
    graphEdges: number;
    elapsedMs: number;
}

interface EvalSummary {
    datasetId: string;
    datasetName: string;
    config: LabConfig;
    totalQuestions: number;
    avgTermRecall: number;
    avgSourceRecall: number;
    hitRate: number;
    avgTopScore: number;
    avgScore: number;
    avgChunkCount: number;
    avgGraphNodes: number;
    avgGraphEdges: number;
    totalElapsedMs: number;
    items: EvalItem[];
}

export default function RagLabPanel() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<RagResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topK, setTopK] = useState(5);
    const [rewrite, setRewrite] = useState(true);
    const [includeAnswer, setIncludeAnswer] = useState(true);
    const [elapsedMs, setElapsedMs] = useState<number | null>(null);
    const [useGraph, setUseGraph] = useState(true);
    const [compareConfigA, setCompareConfigA] = useState<LabConfig>({
        topK: 5,
        rewrite: true,
        includeAnswer: true,
        useGraph: true,
    });
    const [compareConfigB, setCompareConfigB] = useState<LabConfig>({
        topK: 5,
        rewrite: true,
        includeAnswer: true,
        useGraph: true,
    });
    const [compareResultA, setCompareResultA] = useState<RagResult | null>(null);
    const [compareResultB, setCompareResultB] = useState<RagResult | null>(null);
    const [compareElapsedA, setCompareElapsedA] = useState<number | null>(null);
    const [compareElapsedB, setCompareElapsedB] = useState<number | null>(null);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [compareLoading, setCompareLoading] = useState(false);
    const initialDatasets = (teachingDataset as { datasets: TeachingDataset[] }).datasets || [];
    const [datasetDrafts, setDatasetDrafts] = useState<TeachingDataset[]>(
        () => JSON.parse(JSON.stringify(initialDatasets)) as TeachingDataset[]
    );
    const [datasetId, setDatasetId] = useState(datasetDrafts[0]?.id || '');
    const activeDataset = useMemo(
        () => datasetDrafts.find(d => d.id === datasetId) || datasetDrafts[0],
        [datasetDrafts, datasetId]
    );
    const [editingDataset, setEditingDataset] = useState<TeachingDataset | null>(null);
    const [editorMode, setEditorMode] = useState<'none' | 'doc' | 'question'>('none');
    const [editorDoc, setEditorDoc] = useState<TeachingDoc | null>(null);
    const [editorQuestion, setEditorQuestion] = useState<TeachingQuestion | null>(null);
    const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState<string | null>(null);
    const [evalLoading, setEvalLoading] = useState(false);
    const [evalProgress, setEvalProgress] = useState({ done: 0, total: 0 });
    const [evalError, setEvalError] = useState<string | null>(null);
    const [evalResult, setEvalResult] = useState<EvalSummary | null>(null);
    const [evalCompareResult, setEvalCompareResult] = useState<{ a: EvalSummary; b: EvalSummary } | null>(null);
    const [history, setHistory] = useState<Array<{
        id: string;
        query: string;
        topK: number;
        rewrite: boolean;
        includeAnswer: boolean;
        useGraph: boolean;
        elapsedMs: number | null;
        result: RagResult;
        createdAt: number;
    }>>([]);
    const { pushToast } = useToast();

    const normalizedScores = result?.context?.length
        ? result.context.map(c => c.score)
        : [];
    const maxScore = normalizedScores.length ? Math.max(...normalizedScores) : 1;

    const sourceCounts = result?.context?.reduce<Record<string, number>>((acc, c) => {
        const key = c.source || '未知來源';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {}) || {};
    const totalSources = Object.values(sourceCounts).reduce((a, b) => a + b, 0) || 1;

    const getStats = (res?: RagResult | null) => {
        const chunks = res?.context || [];
        const scores = chunks.map(c => c.score ?? 0);
        const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const topScore = scores.length ? Math.max(...scores) : 0;
        const sources = new Set(chunks.map(c => c.source || '未知來源'));
        return {
            chunks: chunks.length,
            avgScore,
            topScore,
            sourceCount: sources.size,
            answerLen: res?.answer?.length || 0,
            graphNodes: res?.graphEvidence?.nodes?.length || 0,
            graphEdges: res?.graphEvidence?.edges?.length || 0,
            rewrittenQuery: res?.rewrittenQuery || '',
        };
    };

    const buildChunkKey = (chunk: RagResult['context'][number]) => {
        const meta = chunk.metadata || {};
        const chunkId = meta.chunk_id || (meta as any).chunkId;
        if (chunkId) return String(chunkId);
        const textHead = (chunk.text || '').slice(0, 80);
        return `${chunk.source || '未知來源'}::${textHead}`;
    };

    const compareStatsA = useMemo(() => getStats(compareResultA), [compareResultA]);
    const compareStatsB = useMemo(() => getStats(compareResultB), [compareResultB]);
    const compareOverlap = useMemo(() => {
        const aChunks = compareResultA?.context || [];
        const bChunks = compareResultB?.context || [];
        if (!aChunks.length || !bChunks.length) return { overlap: 0, aTotal: aChunks.length, bTotal: bChunks.length };
        const aSet = new Set(aChunks.map(buildChunkKey));
        const bSet = new Set(bChunks.map(buildChunkKey));
        let overlap = 0;
        aSet.forEach(key => {
            if (bSet.has(key)) overlap += 1;
        });
        return { overlap, aTotal: aSet.size, bTotal: bSet.size };
    }, [compareResultA, compareResultB]);

    const applyConfigToMain = (cfg: LabConfig) => {
        setTopK(cfg.topK);
        setRewrite(cfg.rewrite);
        setIncludeAnswer(cfg.includeAnswer);
        setUseGraph(cfg.useGraph);
    };

    const buildComparePreset = (preset: 'topk' | 'rewrite' | 'graph' | 'answer') => {
        const base: LabConfig = { topK, rewrite, includeAnswer, useGraph };
        if (preset === 'topk') {
            return {
                a: { ...base, topK: Math.max(1, Math.min(50, 3)) },
                b: { ...base, topK: Math.max(1, Math.min(50, 8)) }
            };
        }
        if (preset === 'rewrite') {
            return {
                a: { ...base, rewrite: false },
                b: { ...base, rewrite: true }
            };
        }
        if (preset === 'graph') {
            return {
                a: { ...base, useGraph: false },
                b: { ...base, useGraph: true }
            };
        }
        return {
            a: { ...base, includeAnswer: false },
            b: { ...base, includeAnswer: true }
        };
    };

    const applyComparePreset = (preset: 'topk' | 'rewrite' | 'graph' | 'answer') => {
        const next = buildComparePreset(preset);
        setCompareConfigA(next.a);
        setCompareConfigB(next.b);
        if (!query.trim()) {
            setQuery('請比較不同設定下的檢索差異');
        }
        return next;
    };

    const ensureQuery = (fallback: string) => {
        const trimmed = query.trim();
        if (trimmed) return trimmed;
        setQuery(fallback);
        return fallback;
    };

    const normalize = (value: string) => value.toLowerCase();

    const evaluateQuestion = (res: RagResult, q: TeachingQuestion) => {
        const chunks = res.context || [];
        const termHits = new Set<string>();
        const sourceHits = new Set<string>();
        const expectedTerms = q.expected_terms || [];
        const expectedSources = q.expected_sources || [];
        const scores = chunks.map(c => c.score ?? 0);
        const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const topScore = scores.length ? Math.max(...scores) : 0;

        chunks.forEach(chunk => {
            const text = normalize(chunk.text || '');
            const source = normalize(chunk.source || '');
            expectedTerms.forEach(term => {
                if (term && text.includes(normalize(term))) termHits.add(term);
            });
            expectedSources.forEach(src => {
                if (src && source.includes(normalize(src))) sourceHits.add(src);
            });
        });

        const termRecall = expectedTerms.length ? termHits.size / expectedTerms.length : 0;
        const sourceRecall = expectedSources.length ? sourceHits.size / expectedSources.length : 0;
        const hit = termHits.size > 0 || sourceHits.size > 0;
        const graphNodes = res.graphEvidence?.nodes?.length || 0;
        const graphEdges = res.graphEvidence?.edges?.length || 0;

        return {
            termRecall,
            sourceRecall,
            hit,
            avgScore,
            topScore,
            chunkCount: chunks.length,
            graphNodes,
            graphEdges,
        };
    };

    const evaluateDatasetInternal = async (config: LabConfig, progressBase: number, progressTotal: number) => {
        if (!activeDataset) return null;
        let totalElapsedMs = 0;
        const items: EvalItem[] = [];
        for (let i = 0; i < activeDataset.questions.length; i++) {
            const q = activeDataset.questions[i];
            const { data, elapsed } = await runRetrieve({
                query: q.question,
                ...config
            });
            totalElapsedMs += elapsed;
            const metrics = evaluateQuestion(data, q);
            items.push({
                id: q.id,
                question: q.question,
                elapsedMs: elapsed,
                ...metrics,
            });
            setEvalProgress({ done: progressBase + i + 1, total: progressTotal });
        }
        const totalQuestions = items.length || 1;
        const avgTermRecall = items.reduce((sum, it) => sum + it.termRecall, 0) / totalQuestions;
        const avgSourceRecall = items.reduce((sum, it) => sum + it.sourceRecall, 0) / totalQuestions;
        const hitRate = items.reduce((sum, it) => sum + (it.hit ? 1 : 0), 0) / totalQuestions;
        const avgTopScore = items.reduce((sum, it) => sum + it.topScore, 0) / totalQuestions;
        const avgScore = items.reduce((sum, it) => sum + it.avgScore, 0) / totalQuestions;
        const avgChunkCount = items.reduce((sum, it) => sum + it.chunkCount, 0) / totalQuestions;
        const avgGraphNodes = items.reduce((sum, it) => sum + it.graphNodes, 0) / totalQuestions;
        const avgGraphEdges = items.reduce((sum, it) => sum + it.graphEdges, 0) / totalQuestions;
        return {
            datasetId: activeDataset.id,
            datasetName: activeDataset.name,
            config,
            totalQuestions: items.length,
            avgTermRecall,
            avgSourceRecall,
            hitRate,
            avgTopScore,
            avgScore,
            avgChunkCount,
            avgGraphNodes,
            avgGraphEdges,
            totalElapsedMs,
            items,
        } as EvalSummary;
    };

    const runEvaluation = async (config: LabConfig) => {
        if (!activeDataset) return null;
        setEvalLoading(true);
        setEvalError(null);
        setEvalResult(null);
        setEvalCompareResult(null);
        setEvalProgress({ done: 0, total: activeDataset.questions.length });
        try {
            const summary = await evaluateDatasetInternal(config, 0, activeDataset.questions.length);
            if (summary) setEvalResult(summary);
            return summary;
        } catch (error: any) {
            console.error('Evaluation error:', error);
            const message = error?.message || '評估失敗，請稍後再試';
            setEvalError(message);
            pushToast({ type: 'error', message });
            return null;
        } finally {
            setEvalLoading(false);
        }
    };

    const runEvaluationCompare = async () => {
        if (!activeDataset) return;
        setEvalLoading(true);
        setEvalError(null);
        setEvalResult(null);
        setEvalCompareResult(null);
        const total = activeDataset.questions.length * 2;
        setEvalProgress({ done: 0, total });
        try {
            const summaryA = await evaluateDatasetInternal(compareConfigA, 0, total);
            if (!summaryA) return;
            const summaryB = await evaluateDatasetInternal(compareConfigB, activeDataset.questions.length, total);
            if (!summaryB) return;
            setEvalCompareResult({ a: summaryA, b: summaryB });
        } catch (error: any) {
            console.error('Evaluation compare error:', error);
            const message = error?.message || '評估比較失敗，請稍後再試';
            setEvalError(message);
            pushToast({ type: 'error', message });
        } finally {
            setEvalLoading(false);
        }
    };

    const fallbackQueries = [
        '星辰科技成立於哪一年？',
        'Orion 智慧助理有哪些功能？',
        '新客戶導入流程有哪些步驟？'
    ];

    const sampleQueries = useMemo(() => {
        const fromDataset = activeDataset?.questions?.map(q => q.question) || [];
        const merged = [...fromDataset, ...fallbackQueries];
        const uniq = merged.filter((q, idx) => merged.indexOf(q) === idx);
        return uniq.slice(0, 3);
    }, [activeDataset]);

    const taskCards: Array<{
        id: 'topk' | 'rewrite' | 'graph' | 'answer';
        title: string;
        desc: string;
        sampleIndex: number;
        aLabel: string;
        bLabel: string;
    }> = [
        {
            id: 'topk',
            title: 'TopK 範圍比較',
            desc: '比較檢索數量變多時，來源覆蓋率與分數分布的差異。',
            sampleIndex: 0,
            aLabel: 'TopK=3',
            bLabel: 'TopK=8',
        },
        {
            id: 'rewrite',
            title: '問題重寫比較',
            desc: '比較重寫前後的檢索品質與關聯節點。',
            sampleIndex: 1,
            aLabel: '重寫關閉',
            bLabel: '重寫開啟',
        },
        {
            id: 'graph',
            title: '圖譜 RAG 比較',
            desc: '比較有無圖譜關聯時的補充資訊差異。',
            sampleIndex: 1,
            aLabel: '圖譜關閉',
            bLabel: '圖譜開啟',
        },
        {
            id: 'answer',
            title: '回答生成比較',
            desc: '比較只看檢索結果 vs 生成回答的差異。',
            sampleIndex: 2,
            aLabel: '回答關閉',
            bLabel: '回答開啟',
        },
    ];

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            pushToast({ type: 'success', message: `已複製：${label}` });
        } catch (error) {
            console.error('Copy failed', error);
            pushToast({ type: 'error', message: '複製失敗，請手動複製' });
        }
    };

    const copyDoc = (doc: TeachingDoc) => {
        copyToClipboard(doc.content, doc.filename);
    };

    const copyAllDocs = () => {
        if (!activeDataset) return;
        const combined = activeDataset.docs
            .map(doc => `# ${doc.filename}\n${doc.content}`)
            .join('\n\n');
        copyToClipboard(combined, `${activeDataset.name} 全部文件`);
    };

    const slugifyId = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 30) || `item-${Date.now()}`;

    const normalizeList = (value: any) => {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
        return [];
    };

    const normalizeDataset = (raw: any): TeachingDataset => {
        const name = String(raw?.name || raw?.title || '未命名資料集');
        const id = String(raw?.id || slugifyId(name));
        const description = String(raw?.description || '');
        const docs = Array.isArray(raw?.docs)
            ? raw.docs.map((doc: any, idx: number) => {
                const filename = String(doc?.filename || doc?.title || `doc-${idx + 1}.txt`);
                const title = String(doc?.title || doc?.filename || filename);
                return {
                    id: String(doc?.id || slugifyId(filename)),
                    filename,
                    title,
                    content: String(doc?.content || ''),
                } as TeachingDoc;
            })
            : [];
        const questions = Array.isArray(raw?.questions)
            ? raw.questions.map((q: any, idx: number) => ({
                id: String(q?.id || slugifyId(q?.question || `question-${idx + 1}`)),
                question: String(q?.question || ''),
                expected_terms: normalizeList(q?.expected_terms ?? q?.expectedTerms),
                expected_sources: normalizeList(q?.expected_sources ?? q?.expectedSources),
            }))
            : [];
        return {
            id,
            name,
            description,
            docs,
            questions,
        };
    };

    const updateDatasetDraft = (datasetId: string, updater: (d: TeachingDataset) => TeachingDataset) => {
        setDatasetDrafts(prev => prev.map(d => (d.id === datasetId ? updater(d) : d)));
    };

    const beginEditDoc = (doc: TeachingDoc) => {
        if (!activeDataset) return;
        setEditingDataset(activeDataset);
        setEditorMode('doc');
        setEditorDoc({ ...doc });
        setEditorQuestion(null);
        setEditorTargetId(doc.id);
    };

    const beginEditQuestion = (q: TeachingQuestion) => {
        if (!activeDataset) return;
        setEditingDataset(activeDataset);
        setEditorMode('question');
        setEditorQuestion({
            ...q,
            expected_terms: [...(q.expected_terms || [])],
            expected_sources: [...(q.expected_sources || [])],
        });
        setEditorDoc(null);
        setEditorTargetId(q.id);
    };

    const resetEditor = () => {
        setEditingDataset(null);
        setEditorMode('none');
        setEditorDoc(null);
        setEditorQuestion(null);
        setEditorTargetId(null);
    };

    const saveEditor = () => {
        if (!editingDataset) return;
        if (editorMode === 'doc' && editorDoc) {
            const nextDoc = {
                ...editorDoc,
                id: editorDoc.id || editorTargetId || slugifyId(editorDoc.filename || editorDoc.title),
                filename: editorDoc.filename || '未命名文件.txt',
                title: editorDoc.title || editorDoc.filename || '未命名文件',
            };
            updateDatasetDraft(editingDataset.id, d => {
                const exists = d.docs.find(doc => doc.id === editorTargetId);
                const docs = exists
                    ? d.docs.map(doc => (doc.id === editorTargetId ? nextDoc : doc))
                    : [...d.docs, nextDoc];
                return { ...d, docs };
            });
        }
        if (editorMode === 'question' && editorQuestion) {
            const nextQuestion = {
                ...editorQuestion,
                id: editorQuestion.id || editorTargetId || slugifyId(editorQuestion.question),
                expected_terms: editorQuestion.expected_terms.filter(Boolean),
                expected_sources: editorQuestion.expected_sources.filter(Boolean),
            };
            updateDatasetDraft(editingDataset.id, d => {
                const exists = d.questions.find(q => q.id === editorTargetId);
                const questions = exists
                    ? d.questions.map(q => (q.id === editorTargetId ? nextQuestion : q))
                    : [...d.questions, nextQuestion];
                return { ...d, questions };
            });
        }
        resetEditor();
    };

    const removeDoc = (docId: string) => {
        if (!activeDataset) return;
        updateDatasetDraft(activeDataset.id, d => ({
            ...d,
            docs: d.docs.filter(doc => doc.id !== docId),
        }));
    };

    const removeQuestion = (questionId: string) => {
        if (!activeDataset) return;
        updateDatasetDraft(activeDataset.id, d => ({
            ...d,
            questions: d.questions.filter(q => q.id !== questionId),
        }));
    };

    const exportDatasetsJson = () => {
        const payload = { version: new Date().toISOString().slice(0, 10), datasets: datasetDrafts };
        copyToClipboard(JSON.stringify(payload, null, 2), '題庫 JSON');
    };

    const downloadText = (filename: string, content: string, mime = 'text/plain') => {
        const blob = new Blob([content], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    const toCsv = (rows: Array<Record<string, string | number>>) => {
        if (!rows.length) return '';
        const headers = Object.keys(rows[0]);
        const escape = (value: string | number) => {
            const text = String(value ?? '');
            if (/[\",\n]/.test(text)) return `"${text.replace(/\"/g, '""')}"`;
            return text;
        };
        const lines = [
            headers.join(','),
            ...rows.map(row => headers.map(h => escape(row[h] ?? '')).join(','))
        ];
        return lines.join('\n');
    };

    const exportEvalCsv = (summary: EvalSummary) => {
        const rows = summary.items.map(item => ({
            question_id: item.id,
            question: item.question,
            term_recall: (item.termRecall * 100).toFixed(1),
            source_recall: (item.sourceRecall * 100).toFixed(1),
            hit: item.hit ? 'yes' : 'no',
            avg_score: item.avgScore.toFixed(4),
            top_score: item.topScore.toFixed(4),
            chunk_count: item.chunkCount,
            graph_nodes: item.graphNodes,
            graph_edges: item.graphEdges,
            elapsed_ms: item.elapsedMs,
        }));
        const csv = toCsv(rows);
        copyToClipboard(csv, '評估 CSV');
    };

    const exportEvalJson = (summary: EvalSummary) => {
        copyToClipboard(JSON.stringify(summary, null, 2), '評估 JSON');
    };

    const downloadEvalCsv = (summary: EvalSummary) => {
        const rows = summary.items.map(item => ({
            question_id: item.id,
            question: item.question,
            term_recall: (item.termRecall * 100).toFixed(1),
            source_recall: (item.sourceRecall * 100).toFixed(1),
            hit: item.hit ? 'yes' : 'no',
            avg_score: item.avgScore.toFixed(4),
            top_score: item.topScore.toFixed(4),
            chunk_count: item.chunkCount,
            graph_nodes: item.graphNodes,
            graph_edges: item.graphEdges,
            elapsed_ms: item.elapsedMs,
        }));
        const csv = toCsv(rows);
        downloadText(`rag-eval-${summary.datasetId}.csv`, csv, 'text/csv');
    };

    const downloadEvalJson = (summary: EvalSummary) => {
        downloadText(`rag-eval-${summary.datasetId}.json`, JSON.stringify(summary, null, 2), 'application/json');
    };

    const downloadDatasetsJson = () => {
        const payload = { version: new Date().toISOString().slice(0, 10), datasets: datasetDrafts };
        downloadText('rag-teaching-dataset.json', JSON.stringify(payload, null, 2), 'application/json');
    };

    const applyImportedDatasets = (raw: any) => {
        const rawDatasets = Array.isArray(raw) ? raw : raw?.datasets;
        if (!Array.isArray(rawDatasets) || rawDatasets.length === 0) {
            throw new Error('找不到 datasets 陣列');
        }
        const normalized = rawDatasets.map(normalizeDataset);
        setDatasetDrafts(normalized);
        setDatasetId(normalized[0]?.id || '');
        setImportOpen(false);
        setImportText('');
        setImportError(null);
        pushToast({ type: 'success', message: '題庫匯入成功（已載入到教學坊）' });
    };

    const handleImport = () => {
        try {
            const parsed = JSON.parse(importText);
            applyImportedDatasets(parsed);
        } catch (error: any) {
            setImportError(error?.message || 'JSON 格式不正確');
        }
    };

    const handleImportFile = (file: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            setImportText(text);
            setImportError(null);
        };
        reader.readAsText(file);
    };

    const exportEvalCompareCsv = (compare: { a: EvalSummary; b: EvalSummary }) => {
        const rows = [
            ...compare.a.items.map(item => ({
                variant: 'A',
                question_id: item.id,
                question: item.question,
                term_recall: (item.termRecall * 100).toFixed(1),
                source_recall: (item.sourceRecall * 100).toFixed(1),
                hit: item.hit ? 'yes' : 'no',
                avg_score: item.avgScore.toFixed(4),
                top_score: item.topScore.toFixed(4),
                chunk_count: item.chunkCount,
                graph_nodes: item.graphNodes,
                graph_edges: item.graphEdges,
                elapsed_ms: item.elapsedMs,
            })),
            ...compare.b.items.map(item => ({
                variant: 'B',
                question_id: item.id,
                question: item.question,
                term_recall: (item.termRecall * 100).toFixed(1),
                source_recall: (item.sourceRecall * 100).toFixed(1),
                hit: item.hit ? 'yes' : 'no',
                avg_score: item.avgScore.toFixed(4),
                top_score: item.topScore.toFixed(4),
                chunk_count: item.chunkCount,
                graph_nodes: item.graphNodes,
                graph_edges: item.graphEdges,
                elapsed_ms: item.elapsedMs,
            })),
        ];
        copyToClipboard(toCsv(rows), '評估 A/B CSV');
    };

    const exportEvalCompareJson = (compare: { a: EvalSummary; b: EvalSummary }) => {
        copyToClipboard(JSON.stringify(compare, null, 2), '評估 A/B JSON');
    };

    const downloadEvalCompareCsv = (compare: { a: EvalSummary; b: EvalSummary }) => {
        const rows = [
            ...compare.a.items.map(item => ({
                variant: 'A',
                question_id: item.id,
                question: item.question,
                term_recall: (item.termRecall * 100).toFixed(1),
                source_recall: (item.sourceRecall * 100).toFixed(1),
                hit: item.hit ? 'yes' : 'no',
                avg_score: item.avgScore.toFixed(4),
                top_score: item.topScore.toFixed(4),
                chunk_count: item.chunkCount,
                graph_nodes: item.graphNodes,
                graph_edges: item.graphEdges,
                elapsed_ms: item.elapsedMs,
            })),
            ...compare.b.items.map(item => ({
                variant: 'B',
                question_id: item.id,
                question: item.question,
                term_recall: (item.termRecall * 100).toFixed(1),
                source_recall: (item.sourceRecall * 100).toFixed(1),
                hit: item.hit ? 'yes' : 'no',
                avg_score: item.avgScore.toFixed(4),
                top_score: item.topScore.toFixed(4),
                chunk_count: item.chunkCount,
                graph_nodes: item.graphNodes,
                graph_edges: item.graphEdges,
                elapsed_ms: item.elapsedMs,
            })),
        ];
        downloadText(`rag-eval-${compare.a.datasetId}-compare.csv`, toCsv(rows), 'text/csv');
    };

    const downloadEvalCompareJson = (compare: { a: EvalSummary; b: EvalSummary }) => {
        downloadText(`rag-eval-${compare.a.datasetId}-compare.json`, JSON.stringify(compare, null, 2), 'application/json');
    };

    const compareHints = useMemo(() => {
        if (!compareResultA || !compareResultB) return [];
        const hints: string[] = [];
        if (compareConfigA.topK !== compareConfigB.topK) {
            hints.push('TopK 不同：觀察「來源數量」「片段重疊」是否提升，並留意平均分數是否下降。');
        }
        if (compareConfigA.rewrite !== compareConfigB.rewrite) {
            hints.push('問題重寫開關不同：比較「重寫後問題」與「平均分數」是否更穩定。');
        }
        if (compareConfigA.useGraph !== compareConfigB.useGraph) {
            hints.push('圖譜 RAG 不同：留意「圖譜節點/關係」是否增加，並觀察回答是否更完整。');
        }
        if (compareConfigA.includeAnswer !== compareConfigB.includeAnswer) {
            hints.push('回答開關不同：觀察只看檢索 vs 生成回答的差異，是否有幻覺風險。');
        }
        if (compareStatsA.sourceCount !== compareStatsB.sourceCount) {
            hints.push('來源數不同：可能代表檢索覆蓋範圍改變，注意召回與雜訊的平衡。');
        }
        if (compareOverlap.overlap === 0) {
            hints.push('片段重疊為 0：兩組設定檢索到完全不同內容，適合做錯誤案例分析。');
        }
        return hints;
    }, [
        compareResultA,
        compareResultB,
        compareConfigA,
        compareConfigB,
        compareStatsA.sourceCount,
        compareStatsB.sourceCount,
        compareOverlap.overlap,
    ]);

    const evalCompareHints = useMemo(() => {
        if (!evalCompareResult) return [];
        const hints: string[] = [];
        const deltaTerm = (evalCompareResult.b.avgTermRecall - evalCompareResult.a.avgTermRecall) * 100;
        const deltaSource = (evalCompareResult.b.avgSourceRecall - evalCompareResult.a.avgSourceRecall) * 100;
        const deltaHit = (evalCompareResult.b.hitRate - evalCompareResult.a.hitRate) * 100;
        const deltaScore = evalCompareResult.b.avgScore - evalCompareResult.a.avgScore;
        if (Math.abs(deltaTerm) >= 3) {
            hints.push(`詞彙召回差異 ${deltaTerm > 0 ? 'B 高於 A' : 'A 高於 B'} ${Math.abs(deltaTerm).toFixed(1)}%。`);
        }
        if (Math.abs(deltaSource) >= 3) {
            hints.push(`來源召回差異 ${deltaSource > 0 ? 'B 高於 A' : 'A 高於 B'} ${Math.abs(deltaSource).toFixed(1)}%。`);
        }
        if (Math.abs(deltaHit) >= 3) {
            hints.push(`命中率差異 ${deltaHit > 0 ? 'B 高於 A' : 'A 高於 B'} ${Math.abs(deltaHit).toFixed(1)}%。`);
        }
        if (Math.abs(deltaScore) >= 0.01) {
            hints.push(`平均分數差異 ${deltaScore > 0 ? 'B 高於 A' : 'A 高於 B'} ${Math.abs(deltaScore).toFixed(4)}。`);
        }
        if (!hints.length) {
            hints.push('整體差異不大，可再調整 TopK 或重寫策略觀察變化。');
        }
        return hints;
    }, [evalCompareResult]);

    const runRetrieve = async (payload: { query: string } & LabConfig) => {
        const startedAt = performance.now();
        const res = await adminFetch('/api/admin/retrieve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });
        const data = await res.json();
        const elapsed = Math.round(performance.now() - startedAt);
        if (!res.ok) {
            throw new Error(data.error || '查詢失敗，請稍後再試');
        }
        return { data, elapsed };
    };

    const runMainQuery = async (inputQuery: string) => {
        const trimmed = inputQuery.trim();
        if (!trimmed) return;

        setLoading(true);
        setResult(null);
        setError(null);
        setElapsedMs(null);

        try {
            const { data, elapsed } = await runRetrieve({
                query: trimmed,
                topK,
                includeAnswer,
                rewrite,
                useGraph
            });
            setElapsedMs(elapsed);
            setResult(data);
            setHistory(prev => {
                const next = [{
                    id: `${Date.now()}`,
                    query: trimmed,
                    topK,
                    rewrite,
                    includeAnswer,
                    useGraph,
                    elapsedMs: elapsed,
                    result: data,
                    createdAt: Date.now(),
                }, ...prev];
                return next.slice(0, 6);
            });
        } catch (error: any) {
            console.error('RAG Debug error:', error);
            const message = error?.message || '查詢失敗，請稍後再試';
            setError(message);
            pushToast({ type: 'error', message });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        await runMainQuery(query);
    };

    const runCompare = async (preset?: { a: LabConfig; b: LabConfig }, overrideQuery?: string) => {
        const activeQuery = (overrideQuery ?? query).trim();
        if (!activeQuery) return;
        setCompareLoading(true);
        setCompareError(null);
        setCompareResultA(null);
        setCompareResultB(null);
        setCompareElapsedA(null);
        setCompareElapsedB(null);
        try {
            const configA = preset?.a ?? compareConfigA;
            const configB = preset?.b ?? compareConfigB;
            if (preset) {
                setCompareConfigA(configA);
                setCompareConfigB(configB);
            }
            const [a, b] = await Promise.all([
                runRetrieve({ query: activeQuery, ...configA }),
                runRetrieve({ query: activeQuery, ...configB }),
            ]);
            setCompareResultA(a.data);
            setCompareResultB(b.data);
            setCompareElapsedA(a.elapsed);
            setCompareElapsedB(b.elapsed);
        } catch (error: any) {
            console.error('Compare error:', error);
            const message = error?.message || '比較失敗，請稍後再試';
            setCompareError(message);
            pushToast({ type: 'error', message });
        } finally {
            setCompareLoading(false);
        }
    };

    const syncCompareFromMain = () => {
        setCompareConfigA({ topK, rewrite, includeAnswer, useGraph });
        setCompareConfigB({ topK, rewrite, includeAnswer, useGraph });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-purple-500">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                <Zap className="w-6 h-6 text-purple-600" />
                RAG 教學坊
            </h2>

            <p className="text-gray-600 mb-6 text-sm">
                在此進行教學型 RAG 測試與比較。您可以輸入問題，觀察問題重寫、檢索片段與最終生成的回答。
            </p>

            <details className="mb-6 rounded-lg border border-purple-100 bg-purple-50/40 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-purple-800">
                    教學模式：互動練習與比較（可展開）
                </summary>
                <div className="mt-4 rounded-lg border border-purple-100 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-2">5 步教學流程</div>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="font-semibold text-slate-700 mb-1">Step 1 準備資料</div>
                            <div className="text-[11px] text-slate-500 mb-2">複製示範文件並建立 .txt 上傳。</div>
                            <button
                                onClick={copyAllDocs}
                                className="rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] hover:bg-slate-800"
                            >
                                複製示範文件
                            </button>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="font-semibold text-slate-700 mb-1">Step 2 上傳索引</div>
                            <div className="text-[11px] text-slate-500 mb-2">到知識庫上傳並重建圖譜。</div>
                            <a
                                href="/admin?tab=knowledge&sub=viz"
                                className="inline-block rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                            >
                                前往上傳
                            </a>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="font-semibold text-slate-700 mb-1">Step 3 單次測試</div>
                            <div className="text-[11px] text-slate-500 mb-2">先跑一次基準結果。</div>
                            <button
                                onClick={() => {
                                    const q = ensureQuery(sampleQueries[0]);
                                    runMainQuery(q);
                                }}
                                className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                            >
                                執行基準測試
                            </button>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="font-semibold text-slate-700 mb-1">Step 4 功能比較</div>
                            <div className="text-[11px] text-slate-500 mb-2">選一組功能做 A/B。</div>
                            <button
                                onClick={() => {
                                    const preset = applyComparePreset('topk');
                                    const q = ensureQuery(sampleQueries[0]);
                                    runCompare(preset, q);
                                }}
                                className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                            >
                                TopK 比較
                            </button>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="font-semibold text-slate-700 mb-1">Step 5 評估</div>
                            <div className="text-[11px] text-slate-500 mb-2">用資料集跑評估指標。</div>
                            <button
                                onClick={() => runEvaluation({ topK, rewrite, includeAnswer, useGraph })}
                                className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                            >
                                執行評估
                            </button>
                        </div>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-purple-100 bg-white p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">快速比較（每個功能至少一組）</div>
                        <p className="text-xs text-gray-500 mb-3">一鍵比較不同設定，觀察檢索與回答差異。</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => {
                                    const preset = applyComparePreset('topk');
                                    const q = ensureQuery(sampleQueries[0]);
                                    runCompare(preset, q);
                                }}
                                className="rounded-full bg-purple-600 text-white px-3 py-1 text-xs hover:bg-purple-700"
                            >
                                TopK 3 vs 8
                            </button>
                            <button
                                onClick={() => {
                                    const preset = applyComparePreset('rewrite');
                                    const q = ensureQuery(sampleQueries[1]);
                                    runCompare(preset, q);
                                }}
                                className="rounded-full bg-purple-600 text-white px-3 py-1 text-xs hover:bg-purple-700"
                            >
                                重寫 開 vs 關
                            </button>
                            <button
                                onClick={() => {
                                    const preset = applyComparePreset('graph');
                                    const q = ensureQuery(sampleQueries[1]);
                                    runCompare(preset, q);
                                }}
                                className="rounded-full bg-purple-600 text-white px-3 py-1 text-xs hover:bg-purple-700"
                            >
                                圖譜 開 vs 關
                            </button>
                            <button
                                onClick={() => {
                                    const preset = applyComparePreset('answer');
                                    const q = ensureQuery(sampleQueries[2]);
                                    runCompare(preset, q);
                                }}
                                className="rounded-full bg-purple-600 text-white px-3 py-1 text-xs hover:bg-purple-700"
                            >
                                回答 開 vs 關
                            </button>
                        </div>

                        <div className="mt-4">
                            <div className="text-xs text-gray-500 mb-2">範例問題（點擊直接填入）</div>
                            <div className="flex flex-wrap gap-2">
                                {sampleQueries.map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => setQuery(q)}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-purple-700 border border-purple-200 hover:bg-purple-50"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-purple-100 bg-white p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">互動練習任務卡</div>
                        <div className="space-y-3">
                            {taskCards.map(task => {
                                const preset = buildComparePreset(task.id);
                                return (
                                    <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <div className="text-xs font-semibold text-gray-700">{task.title}</div>
                                        <div className="text-[11px] text-gray-500 mt-1">{task.desc}</div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <button
                                                onClick={() => {
                                                    const q = ensureQuery(sampleQueries[task.sampleIndex]);
                                                    runCompare(preset, q);
                                                }}
                                                className="rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] hover:bg-slate-800"
                                            >
                                                一鍵比較
                                            </button>
                                            <button
                                                onClick={() => applyConfigToMain(preset.a)}
                                                className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                                            >
                                                套用 A：{task.aLabel}
                                            </button>
                                            <button
                                                onClick={() => applyConfigToMain(preset.b)}
                                                className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                                            >
                                                套用 B：{task.bLabel}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold text-gray-700 mb-2">比較設定 A</div>
                        <div className="flex flex-wrap gap-3 text-xs">
                            <label className="flex items-center gap-2">
                                TopK
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={compareConfigA.topK}
                                    onChange={(e) => setCompareConfigA(prev => ({
                                        ...prev,
                                        topK: Math.max(1, Math.min(50, Number(e.target.value) || 1))
                                    }))}
                                    className="w-16 border rounded px-2 py-1 text-xs"
                                />
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={compareConfigA.rewrite}
                                    onChange={(e) => setCompareConfigA(prev => ({ ...prev, rewrite: e.target.checked }))}
                                />
                                問題重寫
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={compareConfigA.includeAnswer}
                                    onChange={(e) => setCompareConfigA(prev => ({ ...prev, includeAnswer: e.target.checked }))}
                                />
                                生成回答
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={compareConfigA.useGraph}
                                    onChange={(e) => setCompareConfigA(prev => ({ ...prev, useGraph: e.target.checked }))}
                                />
                                圖譜 RAG
                            </label>
                        </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold text-gray-700 mb-2">比較設定 B</div>
                        <div className="flex flex-wrap gap-3 text-xs">
                            <label className="flex items-center gap-2">
                                TopK
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={compareConfigB.topK}
                                    onChange={(e) => setCompareConfigB(prev => ({
                                        ...prev,
                                        topK: Math.max(1, Math.min(50, Number(e.target.value) || 1))
                                    }))}
                                    className="w-16 border rounded px-2 py-1 text-xs"
                                />
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={compareConfigB.rewrite}
                                    onChange={(e) => setCompareConfigB(prev => ({ ...prev, rewrite: e.target.checked }))}
                                />
                                問題重寫
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={compareConfigB.includeAnswer}
                                    onChange={(e) => setCompareConfigB(prev => ({ ...prev, includeAnswer: e.target.checked }))}
                                />
                                生成回答
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={compareConfigB.useGraph}
                                    onChange={(e) => setCompareConfigB(prev => ({ ...prev, useGraph: e.target.checked }))}
                                />
                                圖譜 RAG
                            </label>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        onClick={() => runCompare()}
                        disabled={compareLoading}
                        className="rounded-full bg-purple-600 text-white px-4 py-2 text-xs hover:bg-purple-700 disabled:opacity-50"
                    >
                        {compareLoading ? '比較中...' : '執行比較'}
                    </button>
                    <button
                        onClick={syncCompareFromMain}
                        className="rounded-full bg-white px-4 py-2 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50"
                    >
                        同步主設定 → A/B
                    </button>
                    <button
                        onClick={() => applyConfigToMain(compareConfigA)}
                        className="rounded-full bg-white px-4 py-2 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50"
                    >
                        套用 A 到主設定
                    </button>
                    <button
                        onClick={() => applyConfigToMain(compareConfigB)}
                        className="rounded-full bg-white px-4 py-2 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50"
                    >
                        套用 B 到主設定
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-emerald-100 bg-white p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">示範資料集 / 題庫編輯</div>
                        <p className="text-xs text-gray-500 mb-3">提供可直接用於教學的文件與題目，支援本機編輯與匯出。</p>
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                            <select
                                value={datasetId}
                                onChange={(e) => setDatasetId(e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                            >
                                {datasetDrafts.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={copyAllDocs}
                                disabled={!activeDataset}
                                className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs hover:bg-emerald-700 disabled:opacity-50"
                            >
                                一鍵複製全部文件
                            </button>
                            <button
                                onClick={exportDatasetsJson}
                                className="rounded-full bg-white px-3 py-1 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                            >
                                匯出題庫 JSON
                            </button>
                            <button
                                onClick={downloadDatasetsJson}
                                className="rounded-full bg-white px-3 py-1 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                            >
                                下載題庫 JSON
                            </button>
                            <button
                                onClick={() => { setImportOpen(true); setImportError(null); }}
                                className="rounded-full bg-white px-3 py-1 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                            >
                                匯入題庫 JSON
                            </button>
                            <a
                                href="/admin?tab=knowledge&sub=viz"
                                className="rounded-full bg-white px-3 py-1 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                            >
                                前往知識庫上傳
                            </a>
                        </div>
                        {activeDataset && (
                            <>
                                <div className="text-xs text-gray-600 mb-3">{activeDataset.description}</div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <button
                                        onClick={() => {
                                            if (!activeDataset) return;
                                            setEditingDataset(activeDataset);
                                            setEditorMode('doc');
                                            setEditorDoc({ id: '', filename: '', title: '', content: '' });
                                            setEditorQuestion(null);
                                            setEditorTargetId(null);
                                        }}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                                    >
                                        新增文件
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!activeDataset) return;
                                            setEditingDataset(activeDataset);
                                            setEditorMode('question');
                                            setEditorQuestion({ id: '', question: '', expected_terms: [''], expected_sources: [''] });
                                            setEditorDoc(null);
                                            setEditorTargetId(null);
                                        }}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                                    >
                                        新增題目
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {activeDataset.docs.map(doc => (
                                        <details key={doc.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
                                            <summary className="cursor-pointer text-xs font-medium text-emerald-900 flex items-center justify-between">
                                                <span>{doc.title}（{doc.filename}）</span>
                                                <span className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            beginEditDoc(doc);
                                                        }}
                                                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                                                    >
                                                        編輯
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            copyDoc(doc);
                                                        }}
                                                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                                                    >
                                                        複製
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            removeDoc(doc.id);
                                                        }}
                                                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-red-600 border border-red-200 hover:bg-red-50"
                                                    >
                                                        刪除
                                                    </button>
                                                </span>
                                            </summary>
                                            <pre className="mt-2 whitespace-pre-wrap text-[11px] text-emerald-900/80 bg-white rounded border border-emerald-100 p-2 max-h-40 overflow-auto">
                                                {doc.content}
                                            </pre>
                                        </details>
                                    ))}
                                </div>

                                <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                                        題庫（{activeDataset.questions.length} 題）
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                        {activeDataset.questions.map(q => (
                                            <div key={q.id} className="rounded border border-slate-200 bg-white p-2">
                                                <div className="text-xs font-medium text-slate-800">{q.question}</div>
                                                <div className="text-[11px] text-slate-500 mt-1">
                                                    期望詞彙：{q.expected_terms.join('、') || '—'} | 期望來源：{q.expected_sources.join('、') || '—'}
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <button
                                                        onClick={() => beginEditQuestion(q)}
                                                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                                                    >
                                                        編輯
                                                    </button>
                                                    <button
                                                        onClick={() => setQuery(q.question)}
                                                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                                                    >
                                                        帶入問題
                                                    </button>
                                                    <button
                                                        onClick={() => removeQuestion(q.id)}
                                                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-red-600 border border-red-200 hover:bg-red-50"
                                                    >
                                                        刪除
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </>
                        )}
                    </div>

                    <div className="rounded-lg border border-purple-100 bg-white p-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">評估與對照</div>
                        <p className="text-xs text-gray-500 mb-3">以資料集題目評估檢索效果，支援 A/B 比較。</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                onClick={() => runEvaluation({ topK, rewrite, includeAnswer, useGraph })}
                                disabled={evalLoading || !activeDataset}
                                className="rounded-full bg-purple-600 text-white px-3 py-1 text-xs hover:bg-purple-700 disabled:opacity-50"
                            >
                                {evalLoading ? '評估中...' : '以主設定評估'}
                            </button>
                            <button
                                onClick={runEvaluationCompare}
                                disabled={evalLoading || !activeDataset}
                                className="rounded-full bg-white px-3 py-1 text-xs text-purple-700 border border-purple-200 hover:bg-purple-50 disabled:opacity-50"
                            >
                                以 A/B 設定評估
                            </button>
                        </div>

                        {evalProgress.total > 0 && (
                            <div className="text-[11px] text-gray-500 mb-2">
                                評估進度 {evalProgress.done} / {evalProgress.total}
                            </div>
                        )}
                        {evalError && (
                            <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                                {evalError}
                            </div>
                        )}

                        {evalResult && (
                            <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3 text-[11px] text-purple-900">
                                    <div className="font-semibold mb-2 flex items-center justify-between">
                                        <span>評估結果：{evalResult.datasetName}</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => exportEvalCsv(evalResult)}
                                                className="rounded-full bg-white px-2 py-0.5 text-[11px] text-purple-700 border border-purple-200 hover:bg-purple-50"
                                            >
                                                複製 CSV
                                            </button>
                                            <button
                                                onClick={() => exportEvalJson(evalResult)}
                                                className="rounded-full bg-white px-2 py-0.5 text-[11px] text-purple-700 border border-purple-200 hover:bg-purple-50"
                                            >
                                                複製 JSON
                                            </button>
                                            <button
                                                onClick={() => downloadEvalCsv(evalResult)}
                                                className="rounded-full bg-white px-2 py-0.5 text-[11px] text-purple-700 border border-purple-200 hover:bg-purple-50"
                                            >
                                                下載 CSV
                                            </button>
                                            <button
                                                onClick={() => downloadEvalJson(evalResult)}
                                                className="rounded-full bg-white px-2 py-0.5 text-[11px] text-purple-700 border border-purple-200 hover:bg-purple-50"
                                            >
                                                下載 JSON
                                            </button>
                                        </div>
                                    </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>平均詞彙召回：{(evalResult.avgTermRecall * 100).toFixed(1)}%</div>
                                    <div>平均來源召回：{(evalResult.avgSourceRecall * 100).toFixed(1)}%</div>
                                    <div>命中率：{(evalResult.hitRate * 100).toFixed(1)}%</div>
                                    <div>平均 Top 分數：{evalResult.avgTopScore.toFixed(4)}</div>
                                    <div>平均分數：{evalResult.avgScore.toFixed(4)}</div>
                                    <div>平均片段數：{evalResult.avgChunkCount.toFixed(1)}</div>
                                    <div>圖譜節點：{evalResult.avgGraphNodes.toFixed(1)}</div>
                                    <div>圖譜關係：{evalResult.avgGraphEdges.toFixed(1)}</div>
                                </div>
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-[11px] text-purple-800">查看每題細節</summary>
                                    <div className="mt-2 space-y-2">
                                        {evalResult.items.map(item => (
                                            <div key={item.id} className="rounded border border-purple-100 bg-white p-2">
                                                <div className="font-medium text-purple-900">{item.question}</div>
                                                <div className="text-[11px] text-purple-700">
                                                    詞彙召回 {(item.termRecall * 100).toFixed(0)}% · 來源召回 {(item.sourceRecall * 100).toFixed(0)}% · 命中 {item.hit ? '是' : '否'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        )}

                        {evalCompareResult && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                                <div className="font-semibold mb-2 flex items-center justify-between">
                                    <span>A/B 評估對照</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => exportEvalCompareCsv(evalCompareResult)}
                                            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200 hover:bg-slate-100"
                                        >
                                            複製 CSV
                                        </button>
                                        <button
                                            onClick={() => exportEvalCompareJson(evalCompareResult)}
                                            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200 hover:bg-slate-100"
                                        >
                                            複製 JSON
                                        </button>
                                        <button
                                            onClick={() => downloadEvalCompareCsv(evalCompareResult)}
                                            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200 hover:bg-slate-100"
                                        >
                                            下載 CSV
                                        </button>
                                        <button
                                            onClick={() => downloadEvalCompareJson(evalCompareResult)}
                                            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200 hover:bg-slate-100"
                                        >
                                            下載 JSON
                                        </button>
                                    </div>
                                </div>
                                {evalCompareHints.length > 0 && (
                                    <div className="mb-2 rounded border border-amber-100 bg-amber-50/60 p-2 text-[11px] text-amber-900">
                                        <div className="font-semibold mb-1">觀察點提示</div>
                                        <ul className="list-disc pl-4 space-y-1">
                                            {evalCompareHints.map((hint, idx) => (
                                                <li key={idx}>{hint}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    {[{ key: 'A', data: evalCompareResult.a }, { key: 'B', data: evalCompareResult.b }].map(side => (
                                        <div key={side.key} className="rounded border border-slate-200 bg-white p-2">
                                            <div className="font-medium mb-1">設定 {side.key}</div>
                                            <div>平均詞彙召回：{(side.data.avgTermRecall * 100).toFixed(1)}%</div>
                                            <div>平均來源召回：{(side.data.avgSourceRecall * 100).toFixed(1)}%</div>
                                            <div>命中率：{(side.data.hitRate * 100).toFixed(1)}%</div>
                                            <div>平均分數：{side.data.avgScore.toFixed(4)}</div>
                                        </div>
                                    ))}
                                </div>
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-[11px] text-slate-600">查看題目差異</summary>
                                    <div className="mt-2 space-y-2">
                                        {evalCompareResult.a.items.map((item, idx) => {
                                            const bItem = evalCompareResult.b.items[idx];
                                            return (
                                                <div key={item.id} className="rounded border border-slate-200 bg-white p-2">
                                                    <div className="font-medium">{item.question}</div>
                                                    <div className="text-[11px] text-slate-600">
                                                        A 詞彙召回 {(item.termRecall * 100).toFixed(0)}% · B 詞彙召回 {((bItem?.termRecall || 0) * 100).toFixed(0)}%
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        A 來源召回 {(item.sourceRecall * 100).toFixed(0)}% · B 來源召回 {((bItem?.sourceRecall || 0) * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                </div>
            </details>

            {editingDataset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg border">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="text-sm font-semibold text-gray-800">
                                {editorMode === 'doc' ? '編輯文件' : '編輯題目'}
                            </div>
                            <button
                                onClick={resetEditor}
                                className="text-xs text-gray-600 hover:text-gray-900"
                            >
                                關閉
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            {editorMode === 'doc' && editorDoc && (
                                <>
                                    <label className="block text-xs text-gray-500">
                                        文件名稱
                                        <input
                                            value={editorDoc.filename}
                                            onChange={(e) => setEditorDoc(prev => prev ? { ...prev, filename: e.target.value } : prev)}
                                            className="mt-1 w-full border rounded px-3 py-2 text-sm"
                                        />
                                    </label>
                                    <label className="block text-xs text-gray-500">
                                        標題
                                        <input
                                            value={editorDoc.title}
                                            onChange={(e) => setEditorDoc(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                            className="mt-1 w-full border rounded px-3 py-2 text-sm"
                                        />
                                    </label>
                                    <label className="block text-xs text-gray-500">
                                        內容
                                        <textarea
                                            value={editorDoc.content}
                                            onChange={(e) => setEditorDoc(prev => prev ? { ...prev, content: e.target.value } : prev)}
                                            className="mt-1 w-full border rounded px-3 py-2 text-sm h-40"
                                        />
                                    </label>
                                </>
                            )}

                            {editorMode === 'question' && editorQuestion && (
                                <>
                                    <label className="block text-xs text-gray-500">
                                        問題
                                        <input
                                            value={editorQuestion.question}
                                            onChange={(e) => setEditorQuestion(prev => prev ? { ...prev, question: e.target.value } : prev)}
                                            className="mt-1 w-full border rounded px-3 py-2 text-sm"
                                        />
                                    </label>
                                    <label className="block text-xs text-gray-500">
                                        期望詞彙（逗號分隔）
                                        <input
                                            value={editorQuestion.expected_terms.join(',')}
                                            onChange={(e) => setEditorQuestion(prev => prev ? { ...prev, expected_terms: e.target.value.split(',').map(t => t.trim()) } : prev)}
                                            className="mt-1 w-full border rounded px-3 py-2 text-sm"
                                        />
                                    </label>
                                    <label className="block text-xs text-gray-500">
                                        期望來源（逗號分隔）
                                        <input
                                            value={editorQuestion.expected_sources.join(',')}
                                            onChange={(e) => setEditorQuestion(prev => prev ? { ...prev, expected_sources: e.target.value.split(',').map(t => t.trim()) } : prev)}
                                            className="mt-1 w-full border rounded px-3 py-2 text-sm"
                                        />
                                    </label>
                                </>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t flex justify-end gap-2">
                            <button
                                onClick={resetEditor}
                                className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                            >
                                取消
                            </button>
                            <button
                                onClick={saveEditor}
                                className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
                            >
                                儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {importOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg border">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="text-sm font-semibold text-gray-800">匯入題庫 JSON</div>
                            <button
                                onClick={() => setImportOpen(false)}
                                className="text-xs text-gray-600 hover:text-gray-900"
                            >
                                關閉
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="text-xs text-gray-500">
                                匯入後會覆蓋目前題庫（尚未寫回檔案）。可先下載備份再匯入。
                            </div>
                            <input
                                type="file"
                                accept=".json,application/json"
                                onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
                                className="text-xs"
                            />
                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                className="w-full border rounded px-3 py-2 text-sm h-48"
                                placeholder="貼上題庫 JSON..."
                            />
                            {importError && (
                                <div className="text-xs text-red-600">{importError}</div>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t flex justify-end gap-2">
                            <button
                                onClick={() => setImportOpen(false)}
                                className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleImport}
                                className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                            >
                                匯入
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-4 items-center text-xs mb-4">
                <label className="flex items-center gap-2">
                    TopK
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={topK}
                        onChange={(e) => setTopK(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                        className="w-16 border rounded px-2 py-1 text-xs"
                    />
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} />
                    問題重寫
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={includeAnswer} onChange={(e) => setIncludeAnswer(e.target.checked)} />
                    生成回答
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={useGraph} onChange={(e) => setUseGraph(e.target.checked)} />
                    圖譜 RAG
                </label>
                {elapsedMs !== null && (
                    <span className="text-gray-500">耗時 {elapsedMs} ms</span>
                )}
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="輸入測試問題..."
                    className="flex-1 p-2 border rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    測試
                </button>
            </form>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            {history.length > 0 && (
                <div className="mb-6 bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2">最近測試紀錄</div>
                    <div className="space-y-2">
                        {history.map(run => (
                            <button
                                key={run.id}
                                onClick={() => {
                                    setQuery(run.query);
                                    setTopK(run.topK);
                                    setRewrite(run.rewrite);
                                    setIncludeAnswer(run.includeAnswer);
                                    setUseGraph(run.useGraph);
                                    setElapsedMs(run.elapsedMs);
                                    setResult(run.result);
                                }}
                                className="w-full text-left text-xs border rounded px-3 py-2 hover:bg-gray-50"
                            >
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">{run.query}</span>
                                    <span className="text-gray-400">{new Date(run.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-gray-400 mt-1">
                                    topK={run.topK} | rewrite={String(run.rewrite)} | answer={String(run.includeAnswer)} | 圖譜={String(run.useGraph)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {compareError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {compareError}
                </div>
            )}

            {(compareResultA || compareResultB) && (
                <div className="mb-6 rounded-lg border border-purple-200 bg-white p-4">
                    <div className="text-sm font-semibold text-purple-800 mb-3">比較結果（A / B）</div>
                    {compareHints.length > 0 && (
                        <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-[11px] text-amber-900">
                            <div className="font-semibold mb-1">觀察點提示</div>
                            <ul className="list-disc pl-4 space-y-1">
                                {compareHints.map((hint, idx) => (
                                    <li key={idx}>{hint}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-700">設定 A</span>
                                <span className="text-[11px] text-slate-400">{compareElapsedA !== null ? `耗時 ${compareElapsedA} ms` : '尚未執行'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 mb-2">
                                <span className="rounded-full bg-white px-2 py-0.5 border">TopK {compareConfigA.topK}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 border">重寫 {compareConfigA.rewrite ? '開' : '關'}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 border">回答 {compareConfigA.includeAnswer ? '開' : '關'}</span>
                                    <span className="rounded-full bg-white px-2 py-0.5 border">圖譜 {compareConfigA.useGraph ? '開' : '關'}</span>
                            </div>
                            {compareResultA ? (
                                <div className="space-y-2 text-xs text-slate-600">
                                    <div>檢索片段: {compareStatsA.chunks} | 來源數: {compareStatsA.sourceCount}</div>
                                    <div>平均分數: {compareStatsA.avgScore.toFixed(4)} | 最高分: {compareStatsA.topScore.toFixed(4)}</div>
                                    <div>圖譜節點: {compareStatsA.graphNodes} | 關係: {compareStatsA.graphEdges}</div>
                                    {compareStatsA.rewrittenQuery && (
                                        <div className="text-[11px] text-slate-500">重寫後問題：{compareStatsA.rewrittenQuery}</div>
                                    )}
                                    {compareConfigA.includeAnswer && (
                                        <div className="text-[11px] text-slate-500">回答長度：{compareStatsA.answerLen} 字</div>
                                    )}
                                    <details className="rounded-lg border border-slate-200 bg-white p-2">
                                        <summary className="cursor-pointer text-[11px] text-slate-600">查看前 3 個片段</summary>
                                        <div className="mt-2 space-y-2">
                                            {(compareResultA.context || []).slice(0, 3).map((c, idx) => (
                                                <div key={idx} className="rounded border border-slate-100 bg-slate-50 p-2">
                                                    <div className="text-[11px] text-slate-500">#{idx + 1} · {c.source || '未知來源'} · {c.score.toFixed(4)}</div>
                                                    <div className="text-[11px] text-slate-600 line-clamp-3">{c.text}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">尚未有比較結果</div>
                            )}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-700">設定 B</span>
                                <span className="text-[11px] text-slate-400">{compareElapsedB !== null ? `耗時 ${compareElapsedB} ms` : '尚未執行'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 mb-2">
                                <span className="rounded-full bg-white px-2 py-0.5 border">TopK {compareConfigB.topK}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 border">重寫 {compareConfigB.rewrite ? '開' : '關'}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 border">回答 {compareConfigB.includeAnswer ? '開' : '關'}</span>
                                    <span className="rounded-full bg-white px-2 py-0.5 border">圖譜 {compareConfigB.useGraph ? '開' : '關'}</span>
                            </div>
                            {compareResultB ? (
                                <div className="space-y-2 text-xs text-slate-600">
                                    <div>檢索片段: {compareStatsB.chunks} | 來源數: {compareStatsB.sourceCount}</div>
                                    <div>平均分數: {compareStatsB.avgScore.toFixed(4)} | 最高分: {compareStatsB.topScore.toFixed(4)}</div>
                                    <div>圖譜節點: {compareStatsB.graphNodes} | 關係: {compareStatsB.graphEdges}</div>
                                    {compareStatsB.rewrittenQuery && (
                                        <div className="text-[11px] text-slate-500">重寫後問題：{compareStatsB.rewrittenQuery}</div>
                                    )}
                                    {compareConfigB.includeAnswer && (
                                        <div className="text-[11px] text-slate-500">回答長度：{compareStatsB.answerLen} 字</div>
                                    )}
                                    <details className="rounded-lg border border-slate-200 bg-white p-2">
                                        <summary className="cursor-pointer text-[11px] text-slate-600">查看前 3 個片段</summary>
                                        <div className="mt-2 space-y-2">
                                            {(compareResultB.context || []).slice(0, 3).map((c, idx) => (
                                                <div key={idx} className="rounded border border-slate-100 bg-slate-50 p-2">
                                                    <div className="text-[11px] text-slate-500">#{idx + 1} · {c.source || '未知來源'} · {c.score.toFixed(4)}</div>
                                                    <div className="text-[11px] text-slate-600 line-clamp-3">{c.text}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">尚未有比較結果</div>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                        片段重疊：{compareOverlap.overlap} / A {compareOverlap.aTotal} · B {compareOverlap.bTotal}
                    </div>
                </div>
            )}

            {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 0. Vector Result Chart */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Database className="w-4 h-4" /> 檢索結果可視化
                        </h3>
                        {result.context?.length ? (
                            <div className="space-y-2 bg-white border border-gray-200 rounded-lg p-3">
                                {result.context.map((chunk, idx) => {
                                    const pct = Math.max(5, Math.min(100, chunk.score * 100));
                                    return (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-xs text-gray-600">
                                                <span>Chunk #{idx + 1} - {chunk.source || '未知來源'}</span>
                                                <span>Score {(chunk.score ?? 0).toFixed(4)}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-200 rounded p-3">
                                尚未取得檢索結果。
                            </div>
                        )}
                    </div>

                    {/* 0b. Score vs Rank / Source 分布 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Score vs Rank</h4>
                            {result.context?.length ? result.context.map((c, i) => {
                                const pct = maxScore ? (c.score / maxScore) * 100 : 0;
                                return (
                                    <div key={i} className="space-y-1 mb-2">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span># {i + 1}</span>
                                            <span>{c.score.toFixed(4)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            }) : <div className="text-xs text-gray-500">尚無資料</div>}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">來源分布</h4>
                            {Object.keys(sourceCounts).length ? (
                                <div className="space-y-2">
                                    {Object.entries(sourceCounts).map(([src, cnt], idx) => {
                                        const pct = (cnt / totalSources) * 100;
                                        return (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>{src}</span>
                                                    <span>{cnt} / {totalSources}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div className="h-2 rounded-full bg-purple-500" style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <div className="text-xs text-gray-500">尚無資料</div>}
                        </div>
                    </div>

                    {/* 1. Query Rewrite Flow */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>原始問題: <strong>{query}</strong></span>
                        </div>
                        {result.rewrittenQuery && (
                            <>
                                <ArrowRight className="w-4 h-4" />
                                <div className="flex items-center gap-2 text-purple-700">
                                    <Zap className="w-4 h-4" />
                                    <span>重寫後: <strong>{result.rewrittenQuery}</strong></span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 2. Retrieved Chunks */}
                    <div>
                        <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Database className="w-4 h-4" /> 檢索到的知識片段 (Top {result.context?.length ?? topK})
                        </h3>
                        {result.context?.length ? (
                            <div className="grid gap-3">
                                {result.context.map((chunk, idx) => (
                                    <div key={idx} className="bg-blue-50 p-3 rounded border border-blue-100 text-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-blue-800">Chunk #{idx + 1}</span>
                                            <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-xs">
                                                Score: {chunk.score.toFixed(4)}
                                            </span>
                                        </div>
                                        <p className="text-gray-700 mb-2 line-clamp-3">{chunk.text}</p>
                                        <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                                            <span>長度: {chunk.metadata?.text_length ?? (chunk.text || '').length} chars</span>
                                            {(chunk.metadata?.indexed_at || chunk.indexedAt) && <span>索引時間: {new Date(chunk.metadata?.indexed_at || (chunk as any).indexedAt).toLocaleString()}</span>}
                                            <span>來源: {chunk.source} {chunk.page ? `(Page: ${chunk.page})` : ''}</span>
                                            {(chunk.metadata?.chunk_id || chunk.metadata?.chunkId) && (
                                                <span>ID: {chunk.metadata?.chunk_id || chunk.metadata?.chunkId}</span>
                                            )}
                                            {chunk.metadata?.docId && <span>docId: {chunk.metadata.docId}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded p-3">
                                沒有取得檢索片段，請確認向量資料庫設定或問題內容。
                            </div>
                        )}
                    </div>

                    {result.graphContext && (
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                            <h3 className="text-md font-semibold text-amber-800 mb-2">知識圖譜補充</h3>
                            <div className="text-xs text-amber-900 whitespace-pre-wrap">
                                {result.graphContext}
                            </div>
                        </div>
                    )}

                    {result.graphEvidence && (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="text-md font-semibold text-slate-700 mb-2">圖譜關聯</h3>
                            <div className="text-xs text-slate-600 mb-2">
                                節點 {result.graphEvidence.nodes?.length || 0}，關係 {result.graphEvidence.edges?.length || 0}
                            </div>
                            <div className="mb-2 flex gap-2">
                                <button
                                    onClick={() => {
                                        const url = `/admin?tab=knowledge&sub=viz&graphQuery=${encodeURIComponent(query)}`;
                                        window.open(url, '_blank');
                                    }}
                                    className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200"
                                >
                                    在圖譜標示
                                </button>
                            </div>
                            {result.graphEvidence.triples?.length ? (
                                <div className="space-y-1 text-xs text-slate-700">
                                    {result.graphEvidence.triples.slice(0, 8).map((t, idx) => (
                                        <div key={idx} className="bg-white border rounded px-2 py-1">
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">沒有可用的圖譜關係</div>
                            )}
                        </div>
                    )}

                    {/* 3. Final Answer */}
                    {includeAnswer ? (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h3 className="text-md font-semibold text-green-800 mb-2">AI 最終回答</h3>
                            <div className="prose prose-sm max-w-none text-gray-800">
                                {result.answer}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded p-3">
                            已停用回答生成，只顯示檢索結果。
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
