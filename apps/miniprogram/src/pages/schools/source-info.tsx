import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

interface SchoolSourceInfoProps {
  sourceName: string;
  sourceUrl: string;
  updatedAt: string;
}

export function SchoolSourceInfo({ sourceName, sourceUrl, updatedAt }: SchoolSourceInfoProps) {
  const copySourceUrl = () => {
    Taro.setClipboardData({
      data: sourceUrl,
      success: () => Taro.showToast({ title: '来源链接已复制', icon: 'none' }),
      fail: () => Taro.showToast({ title: '复制失败，请长按链接复制', icon: 'none' }),
    });
  };

  return <View style={{ marginTop: '12rpx' }}>
    <View className="muted">来源：{sourceName}</View>
    <Text selectable className="muted" style={{ display: 'block', marginTop: '8rpx', wordBreak: 'break-all' }}>
      来源链接：{sourceUrl}
    </Text>
    <View className="muted" style={{ marginTop: '8rpx' }}>资料更新：{updatedAt.slice(0, 10)}</View>
    <Button size="mini" onClick={copySourceUrl} style={{ marginTop: '12rpx' }}>复制来源链接</Button>
    <View className="muted" style={{ marginTop: '8rpx' }}>复制后可粘贴到浏览器核验官方资料。</View>
  </View>;
}
