import { useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { NormalizedSchoolQuery, SchoolQueryView } from '@kaoyan/domain';
import { SchoolSourceInfo } from './source-info';

const API = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';

export default function SchoolsPage() {
  const [instruction, setInstruction] = useState('');
  const [query, setQuery] = useState<NormalizedSchoolQuery | null>(null);
  const [result, setResult] = useState<SchoolQueryView | null>(null);
  const [loading, setLoading] = useState(false);
  const token = Taro.getStorageSync('accessToken') as string;

  const search = async () => {
    if (!instruction.trim()) { Taro.showToast({ title: '请描述你的择校条件', icon: 'none' }); return; }
    setLoading(true);
    try {
      const response = await Taro.request<SchoolQueryView>({ url: `${API}/v1/school-queries`, method: 'POST',
        header: { Authorization: `Bearer ${token}` }, data: { instruction } });
      setResult(response.data); setQuery(response.data.query);
    } catch { Taro.showToast({ title: '提交失败，请稍后重试', icon: 'none' }); }
    finally { setLoading(false); }
  };

  if (!token) return <View className="page"><View className="card"><Text>登录后使用择校资料查询</Text><Button onClick={() => Taro.navigateTo({ url: '/pages/me/login' })}>去登录</Button></View></View>;
  return <View className="page">
    <View className="card">
      <Text className="section-title">择校资料（次要入口）</Text>
      <Input value={instruction} maxlength={500} placeholder="例如：2027年想在北京读计算机，优先双一流" onInput={(event) => setInstruction(event.detail.value)} style={{ marginTop: '20rpx' }} />
      <Button type="primary" disabled={loading} onClick={() => void search()} style={{ marginTop: '20rpx' }}>{loading ? '查询中…' : '整理条件并查询'}</Button>
      <View className="muted" style={{ marginTop: '12rpx' }}>当前为人工配置的演示资料，请以院校官方公告为准。</View>
    </View>
    {query && <View className="card">
      <Text>解析条件</Text>
      <View className="muted" style={{ marginTop: '12rpx' }}>{query.year ?? '年份不限'} · {query.region ?? '地区不限'} · {query.major ?? '专业不限'} · {query.schoolType ?? '类型不限'}</View>
      <View className="muted" style={{ marginTop: '8rpx' }}>其他条件：{query.constraints.join('、') || '无'}</View>
    </View>}
    {result && <View className="card">
      <Text>{result.status === 'completed' ? `找到 ${result.results.length} 条资料` : result.status === 'no_results' ? '暂无匹配资料' : '查询暂不可用'}</Text>
      {result.reason && <View className="muted" style={{ marginTop: '12rpx' }}>{result.reason}</View>}
      {result.results.map((school, index) => <View key={`${school.schoolName}-${index}`} style={{ marginTop: '20rpx', paddingTop: '16rpx', borderTop: '1rpx solid #eee' }}>
        <Text>{school.schoolName} · {school.majorName ?? '专业待确认'}</Text>
        {Object.entries(school.fields).map(([key, value]) => <View className="muted" key={key} style={{ marginTop: '8rpx' }}>{key}：{String(value ?? '—')}</View>)}
        <SchoolSourceInfo sourceName={school.sourceName} sourceUrl={school.sourceUrl} updatedAt={school.updatedAt} />
      </View>)}
      <Button size="mini" onClick={() => Taro.navigateTo({ url: `/pages/schools/result?id=${result.id}` })} style={{ marginTop: '16rpx' }}>打开结果页</Button>
      <Button size="mini" onClick={() => void search()} disabled={loading} style={{ marginTop: '16rpx' }}>重试 / 修改条件</Button>
    </View>}
  </View>;
}
