import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import type { SchoolQueryView } from '@kaoyan/domain';

const API = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';

export default function SchoolResultPage() {
  const [result, setResult] = useState<SchoolQueryView | null>(null);
  const [loading, setLoading] = useState(true);
  const token = Taro.getStorageSync('accessToken') as string;
  useLoad((params) => {
    if (!token || !params?.id) { setLoading(false); return; }
    Taro.request<SchoolQueryView>({ url: `${API}/v1/school-queries/${params.id}`, header: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setResult(data)).catch(() => Taro.showToast({ title: '结果加载失败', icon: 'none' })).finally(() => setLoading(false));
  });
  if (loading) return <View className="page"><Text>加载中…</Text></View>;
  if (!result) return <View className="page"><View className="card"><Text>暂时无法加载查询结果</Text><Button onClick={() => Taro.navigateBack()}>返回并重试</Button></View></View>;
  return <View className="page">
    <View className="card"><Text>你的条件</Text><View className="muted" style={{ marginTop: '12rpx' }}>{result.instruction}</View></View>
    {result.reason && <View className="card muted">{result.reason}</View>}
    {result.results.map((school, index) => <View className="card" key={`${school.schoolName}-${index}`}>
      <Text>{school.schoolName} · {school.majorName ?? '专业待确认'}</Text>
      <View className="muted" style={{ marginTop: '12rpx' }}>来源：{school.sourceName}</View>
      <View className="muted" style={{ marginTop: '8rpx' }}>更新时间：{school.updatedAt.slice(0, 10)}</View>
    </View>)}
  </View>;
}
