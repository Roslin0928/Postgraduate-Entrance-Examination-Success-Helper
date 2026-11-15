import { useCallback, useRef, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import type { ImportError, ReviewFeedback } from '@kaoyan/domain';
import WordReviewCard, { ReviewWord } from '../../components/WordReviewCard';
import ImportResult from '../../components/ImportResult';

const API = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export default function VocabularyPage() {
  const router = useRouter();
  const taskId = router.params.taskId;
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<{ totalRows: number; successCount: number; errors: ImportError[] } | null>(null);
  const repeatedUnknown = useRef(new Set<string>());
  const token = Taro.getStorageSync('accessToken') as string;
  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await Taro.request<{ items: ReviewWord[]; count: number }>({ url: `${API}/v1/vocabulary/due`, header: { Authorization: `Bearer ${token}`, 'x-time-zone': timeZone() } });
      setWords(response.data.items); setDueCount(response.data.count); setIndex(0); setRevealed(false); repeatedUnknown.current.clear();
    } catch { Taro.showToast({ title: '词库加载失败', icon: 'none' }); }
    finally { setLoading(false); }
  }, [token]);
  useDidShow(() => { void load(); });

  const feedback = async (value: ReviewFeedback) => {
    const word = words[index];
    if (!word) return;
    try {
      await Taro.request({ url: `${API}/v1/vocabulary/${word.id}/reviews`, method: 'POST',
        header: { Authorization: `Bearer ${token}`, 'x-time-zone': timeZone() },
        data: taskId ? { feedback: value, taskId } : { feedback: value },
      });
      const remaining = [...words];
      const shouldRepeat = value === 'unknown' && !repeatedUnknown.current.has(word.id);
      if (shouldRepeat) { repeatedUnknown.current.add(word.id); remaining.push(word); }
      remaining.splice(index, 1);
      setWords(remaining); if (!shouldRepeat) setDueCount((count) => Math.max(0, count - 1)); setRevealed(false);
      if (index >= remaining.length) setIndex(0);
    } catch { Taro.showToast({ title: '记录失败，请重试', icon: 'none' }); }
  };

  const importFile = async () => {
    try {
      const selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['csv', 'tsv'] });
      const file = selected.tempFiles[0];
      const fs = Taro.getFileSystemManager();
      fs.readFile({ filePath: file.path, encoding: 'utf8', success: async ({ data }) => {
        try {
          const response = await Taro.request<{ totalRows: number; successCount: number; errors: ImportError[] }>({
            url: `${API}/v1/vocabulary/import`, method: 'POST', header: { Authorization: `Bearer ${token}` },
            data: { fileName: file.name, content: data },
          });
          setImportResult(response.data); await load();
        } catch { Taro.showToast({ title: '导入失败', icon: 'none' }); }
      }, fail: () => Taro.showToast({ title: '无法读取文件', icon: 'none' }) });
    } catch { /* user cancelled file selection */ }
  };

  if (!token) return <View className="page"><View className="card"><Text>登录后使用词汇复习</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/me/login' })}>去登录</Button></View></View>;
  const current = words[index];
  return <View className="page">
    <View className="card">
      <Text>今日待复习 {dueCount} 个</Text>
      <View className="muted" style={{ marginTop: '12rpx' }}>{words.length ? `进度 ${Math.min(index + 1, words.length)}/${words.length}` : '复习完成'}</View>
    </View>
    <View className="card"><Button onClick={() => void importFile()}>导入 CSV / TSV</Button></View>
    {importResult && <ImportResult result={importResult} />}
    {loading ? <View className="card"><Text>加载中…</Text></View> : current ? <WordReviewCard word={current} revealed={revealed} onReveal={() => setRevealed(true)} onFeedback={(value) => void feedback(value)} /> : <View className="card"><Text>今天没有待复习单词</Text></View>}
  </View>;
}
