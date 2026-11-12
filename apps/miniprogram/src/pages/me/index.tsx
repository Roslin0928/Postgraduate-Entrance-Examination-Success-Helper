import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

const API_BASE_URL = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';

interface MeView {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  phoneBound: boolean;
  examProfile: {
    targetExamDate: string | null;
    major: string | null;
    targetSchoolId: string | null;
    dailyGoalMinutes: number;
    defaultPomodoroMinutes: number;
  } | null;
}

export default function MePage() {
  const [me, setMe] = useState<MeView | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = Taro.getStorageSync('accessToken') as string | undefined;
    if (!token) {
      setLoaded(true);
      return;
    }
    Taro.request<MeView>({
      url: `${API_BASE_URL}/v1/me`,
      header: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => setMe(data)).catch(() => {
      Taro.removeStorageSync('accessToken');
    }).finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <View className="page"><Text>加载中…</Text></View>;

  if (!me) {
    return (
      <View className="page">
        <View className="card">
          <Text>让备考计划更清晰</Text>
          <View className="muted" style={{ marginTop: '16rpx' }}>
            登录后记录考研目标、每日学习时长和备考进度。
          </View>
          <Button type="primary" onClick={() => Taro.navigateTo({ url: '/pages/me/login' })} style={{ marginTop: '32rpx' }}>
            微信一键登录
          </Button>
        </View>
      </View>
    );
  }

  const profile = me.examProfile;
  return (
    <View className="page">
      <View className="card">
        <Text>{me.nickname ?? '微信用户'}</Text>
        <View className="muted" style={{ marginTop: '12rpx' }}>
          账号状态：已登录 · 手机号{me.phoneBound ? '已绑定' : '未绑定'}
        </View>
        <Button size="mini" onClick={() => Taro.showToast({ title: '手机号绑定即将开放', icon: 'none' })} style={{ marginTop: '20rpx' }}>
          绑定手机号
        </Button>
      </View>
      <View className="card">
        <View>考研时间：{profile?.targetExamDate ?? '未设置'}</View>
        <View style={{ marginTop: '20rpx' }}>目标院校：{profile?.targetSchoolId ?? '暂未选择'}</View>
        <View style={{ marginTop: '20rpx' }}>每日目标：{profile?.dailyGoalMinutes ?? 180} 分钟</View>
      </View>
    </View>
  );
}
