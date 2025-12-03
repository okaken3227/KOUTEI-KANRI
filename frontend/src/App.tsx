import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, useMapEvents, Marker, useMap, LayersControl, Popup } from 'react-leaflet';
import { LatLngTuple, Icon, Marker as LeafletMarker, LeafletMouseEvent } from 'leaflet';
import './App.css';
import { useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { ToastContainer, showToast } from './components/Toast';

// Leafletアイコン設定
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// デフォルトピン（少し小さめ）
const DefaultIcon = new Icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [18, 30], 
    iconAnchor: [9, 30]
});

// 自宅用ピン（色相を変えるためにCSSクラス付与）
const HomeIcon = new Icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41], // 自宅は少し大きく
    iconAnchor: [12, 41],
    className: 'home-marker-icon' // CSSで色を変える
});

// 自宅設定中のピンクのピン
const HomeSettingIcon = new Icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: 'home-setting-marker-icon' // 設定中はピンクのピンを使用
});

const SelectedFieldIcon = new Icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [22, 36],
    iconAnchor: [11, 36],
    className: 'selected-field-marker'
});

// 中点用の半透明アイコン
const MidpointIcon = new Icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [18, 30], 
    iconAnchor: [9, 30],
    className: 'midpoint-marker'
});

type Status =
  | "一番耕起"
  | "二番耕起"
  | "三番耕起"
  | "代掻き"
  | "田植え"
  | "稲刈り"
  | "草刈り"
  | "未着手";

const STATUS_LIST: Status[] = [
  "一番耕起",
  "二番耕起",
  "三番耕起",
  "代掻き",
  "田植え",
  "稲刈り",
  "草刈り",
  "未着手",
];

const STATUS_COLORS: Record<Status, string> = {
  "一番耕起": "#8B4513",
  "二番耕起": "#A0522D",
  "三番耕起": "#CD853F",
  "代掻き": "#4682B4",
  "田植え": "#32CD32",
  "稲刈り": "#DAA520",
  "草刈り": "#2E8B57",
  "未着手": "#808080",
};

interface WorkRecord {
  id: number;
  date: string;
  workType: Status;
  year: number;
  worker?: string;
  weather?: string;
  temperature?: number;
}

interface RiceField {
  id: number;
  name: string;
  owner: string;
  status: Status;
  area?: number | null;
  polygon: {
    type: "Polygon";
    coordinates: number[][][]; 
  };
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const formatAreaLabel = (area?: number | null) => {
  if (area === null || area === undefined || Number.isNaN(area)) return null;
  const formatNumber = (value: number) =>
    Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
  const tan = area / 10;
  const ha = area / 100;
  return `${formatNumber(area)}a (${formatNumber(tan)}反 / ${formatNumber(ha)}ha)`;
};

// 天気コードをテキストに変換（Open-Meteo API用）
const weatherCodeToText = (code: number): string => {
  if (code === 0) return "快晴";
  if (code <= 3) return "晴れ";
  if (code <= 48) return "曇り";
  if (code <= 67) return "雨";
  if (code <= 77) return "雪";
  if (code <= 82) return "にわか雨";
  if (code <= 86) return "にわか雪";
  return "雷雨";
};

const getFieldCenter = (field: RiceField): LatLngTuple | null => {
  const polygon = field.polygon?.coordinates?.[0];
  if (!polygon || polygon.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  polygon.forEach((coord: number[]) => {
    sumLat += coord[1];
    sumLng += coord[0];
  });
  return [sumLat / polygon.length, sumLng / polygon.length];
};

// 地図操作アクションの型定義
type MapAction = { type: 'flyTo', center: LatLngTuple, zoom?: number | null } | null;

// 地図制御コンポーネント
function MapController({ action }: { action: MapAction }) {
  const map = useMap();
  useEffect(() => {
    if (action?.type === 'flyTo') {
      // zoomがnullまたはundefinedの場合は現在のズームレベルを維持
      if (action.zoom === null || action.zoom === undefined) {
        const currentZoom = map.getZoom();
        map.flyTo(action.center, currentZoom);
      } else {
        map.flyTo(action.center, action.zoom);
      }
    }
  }, [action, map]);
  return null;
}

// 中心座標取得用
function MapCenterListener({ onCenterChanged }: { onCenterChanged: (center: LatLngTuple) => void }) {
    const map = useMap();
    useMapEvents({
        moveend: () => {
            const center = map.getCenter();
            onCenterChanged([center.lat, center.lng]);
        }
    });
    return null;
}

// 新規登録用の地図イベントハンドラ
function MapClickHandler({ onClick }: { onClick: (latlng: LatLngTuple) => void }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function App() {
  const { user, token, logout, isLoading } = useAuth();
  
  const [fields, setFields] = useState<RiceField[]>([]);
  const [selectedField, setSelectedField] = useState<RiceField | null>(null);
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPolygonPoints, setNewPolygonPoints] = useState<LatLngTuple[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldOwner, setNewFieldOwner] = useState("");
  const [newFieldArea, setNewFieldArea] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [isFieldListCollapsed, setIsFieldListCollapsed] = useState(true); // 初期値はtrue（検索セクションを表示）
  
  // 履歴編集用の状態
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [editRecordDate, setEditRecordDate] = useState("");
  const [editRecordWorker, setEditRecordWorker] = useState("");
  const [editRecordStatus, setEditRecordStatus] = useState<Status | null>(null);
  
  // 編集モード用の状態
  const [isEditingField, setIsEditingField] = useState(false);
  const [editFieldName, setEditFieldName] = useState("");
  const [editFieldOwner, setEditFieldOwner] = useState("");
  const [editFieldArea, setEditFieldArea] = useState("");
  
  // 削除確認モーダル用の状態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<WorkRecord | null>(null);
  
  // 初回ログイン時の自宅移動フラグ
  const hasNavigatedToHome = useRef(false);
  
  // モバイル用サイドバー状態
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // 地図操作用
  const [mapAction, setMapAction] = useState<MapAction>(null);
  const [currentMapCenter, setCurrentMapCenter] = useState<LatLngTuple>([35.6812, 139.7671]); // 初期値
  const [selectedFieldCenter, setSelectedFieldCenter] = useState<LatLngTuple | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 自宅関連
  const [homeLocation, setHomeLocation] = useState<LatLngTuple | null>(null);
  const [isSettingHome, setIsSettingHome] = useState(false);
  const [tempHomeLocation, setTempHomeLocation] = useState<LatLngTuple | null>(null);

  // 本番環境では空文字列（相対パス）、開発環境ではlocalhost
  const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:3000");
  
  const sidebarRef = useRef<HTMLDivElement>(null);

  // すべてのuseEffectとハンドラー関数を先に定義
  const fetchFields = useCallback(async () => {
    if (!token) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト
      
      const res = await fetch(`${API_URL}/api/fields`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        if (res.status === 503) {
          showToast("サーバーが準備中です。しばらく待ってから再度お試しください。", "error");
          return;
        }
        console.error("Failed to fetch fields:", res.status, res.statusText);
        setFields([]);
        showToast("データの取得に失敗しました", "error");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setFields(data);
      } else {
        console.error("Invalid response format:", data);
        setFields([]);
        showToast("データの形式が正しくありません", "error");
      }
    } catch (error: any) {
      console.error("Failed to fetch fields:", error);
      setFields([]);
      if (error.name === 'AbortError') {
        showToast("通信がタイムアウトしました。ネットワーク接続を確認してください。", "error");
      } else if (error.message?.includes('fetch')) {
        showToast("ネットワークエラーが発生しました。接続を確認してください。", "error");
      } else {
        showToast("データの取得に失敗しました", "error");
      }
    }
  }, [token, logout, API_URL]);

  useEffect(() => {
    if (token) {
      fetchFields();
    }
    // LocalStorageから自宅位置と作業者名を読み込み（ユーザーごとに分離）
    if (user && user.id) {
      try {
        const savedHome = localStorage.getItem(`nouka_map_home_${user.id}`);
        if (savedHome) {
          const parsedHome = JSON.parse(savedHome);
          // 配列形式で、2つの要素（緯度、経度）があることを確認
          if (Array.isArray(parsedHome) && parsedHome.length === 2 && 
              typeof parsedHome[0] === 'number' && typeof parsedHome[1] === 'number') {
            setHomeLocation(parsedHome as LatLngTuple);
          } else {
            console.warn("Invalid home location format:", parsedHome);
            localStorage.removeItem(`nouka_map_home_${user.id}`);
          }
        }
        const savedWorker = localStorage.getItem(`nouka_map_worker_${user.id}`);
        if (savedWorker) {
          setWorkerName(savedWorker);
        }
      } catch (error) {
        console.error("Failed to load home location:", error);
        // エラーが発生した場合は、破損したデータを削除
        localStorage.removeItem(`nouka_map_home_${user.id}`);
      }
    }
  }, [token, fetchFields, user]);

  useEffect(() => {
    // ユーザーがログアウトしたときに自宅位置と作業者名をクリア
    if (!user) {
      setHomeLocation(null);
      setWorkerName("");
      hasNavigatedToHome.current = false; // ログアウト時にリセット
    }
  }, [user]);

  // 画面リサイズ時の処理
  useEffect(() => {
    const handleResize = () => {
      // PCレイアウト(1024px超)になったら、モバイルサイドバーの状態をリセット
      if (window.innerWidth > 1024) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // ログイン時にメニューを閉じる（自宅への移動アニメーションを見せるため）
    if (user) {
      setIsMobileSidebarOpen(false);
    }
  }, [user]);

  useEffect(() => {
    // ログイン時、自宅位置が設定されている場合は自動的に移動
    if (user && homeLocation && !hasNavigatedToHome.current) {
      setMapAction({
        type: 'flyTo',
        center: homeLocation,
        zoom: 18
      });
      hasNavigatedToHome.current = true; // 一度移動したらフラグを立てる
    }
  }, [user, homeLocation]);

  useEffect(() => {
    if (selectedField) {
      fetchRecords(selectedField.id);
      // 詳細表示時はサイドバーを開く（モバイル）
      setIsMobileSidebarOpen(true);
      // 編集用フィールドを初期化
      setEditFieldName(selectedField.name);
      setEditFieldOwner(selectedField.owner || "");
      setEditFieldArea(selectedField.area?.toString() || "");
      setIsEditingField(false);

      // サイドバーのスクロールをトップに戻す（少し遅延させて確実に実行）
      setTimeout(() => {
        if (sidebarRef.current) {
          sidebarRef.current.scrollTop = 0;
        }
      }, 100);
    }
  }, [selectedField]);

  // selectedFieldがnullになった時にselectedFieldCenterもクリア
  useEffect(() => {
    if (!selectedField) {
      setSelectedFieldCenter((prev) => prev !== null ? null : prev);
    }
  }, [selectedField]);

  const fetchRecords = async (fieldId: number) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(`${API_URL}/api/fields/${fieldId}/records`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        console.error("Failed to fetch records:", res.status);
        showToast("作業履歴の取得に失敗しました", "error");
        return;
      }
      const data = await res.json();
      setRecords(data);

      const latestStatus: Status = data.length > 0 ? data[0].workType : "未着手";
      setSelectedField((prev) => {
        if (prev && prev.id === fieldId && prev.status !== latestStatus) {
          return { ...prev, status: latestStatus };
        }
        return prev;
      });
      setFields((prev) =>
        prev.map((field) =>
          field.id === fieldId && field.status !== latestStatus
            ? { ...field, status: latestStatus }
            : field
        )
      );
    } catch (error: any) {
      console.error("Failed to fetch records:", error);
      if (error.name === 'AbortError') {
        showToast("通信がタイムアウトしました", "error");
      } else if (error.message?.includes('fetch')) {
        showToast("ネットワークエラーが発生しました", "error");
      } else {
        showToast("作業履歴の取得に失敗しました", "error");
      }
    }
  };

  const focusFieldOnMap = (field: RiceField) => {
    const center = getFieldCenter(field);
    if (center) {
      setSelectedFieldCenter(center);
      setMapAction({
        type: 'flyTo',
        center,
        zoom: 18
      });
    } else {
      setSelectedFieldCenter(null);
    }
  };

  const handleSelectField = (field: RiceField) => {
    setSelectedField(field);
    setIsCreating(false);
    setIsSettingHome(false);
    focusFieldOnMap(field);
    // モバイルでは詳細を表示するためにサイドバーを開く
    // すでに開いている場合でも詳細パネルに切り替わるのでOK
    // ただし地図も見たい場合は一度閉じるなどのUXもあり得るが、
    // ここでは詳細確認を優先して開いたまま、あるいは閉じていたなら開く挙動にする
    setIsMobileSidebarOpen(true);
    
    // 詳細パネルまで自動スクロール
    setTimeout(() => {
      const detailTitle = document.querySelector('.detail-title');
      if (detailTitle) {
        detailTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleUpdateField = async () => {
    if (!selectedField || !user) return;

    const parsedArea = editFieldArea !== "" && !Number.isNaN(Number(editFieldArea)) 
      ? Number(editFieldArea) 
      : null;

    try {
      const res = await fetch(`${API_URL}/api/fields/${selectedField.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: editFieldName,
          owner: editFieldOwner,
          area: parsedArea
        })
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        showToast("更新に失敗しました", "error");
        return;
      }

      const updatedField = await res.json();
      setFields(fields.map(f => f.id === updatedField.id ? updatedField : f));
      setSelectedField(updatedField);
      setIsEditingField(false);
      showToast("更新しました", "success");
    } catch (error) {
      console.error("Failed to update field:", error);
      showToast("更新に失敗しました", "error");
    }
  };

  const handleStatusChange = async (status: Status) => {
    if (!selectedField || !user) return;
    
    // ボタンを選択状態にする
    setSelectedStatus(status);
  };

  const handleUpdateStatus = async () => {
    if (!selectedField || !user || !selectedStatus) return;
    localStorage.setItem(`nouka_map_worker_${user.id}`, workerName);

    try {
      // 天気情報を取得（Open-Meteo API）
      let weather = null;
      let temperature = null;
      const center = getFieldCenter(selectedField);
      if (center) {
        try {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${center[0]}&longitude=${center[1]}&daily=weather_code,temperature_2m_max&timezone=Asia/Tokyo&start_date=${workDate}&end_date=${workDate}`
          );
          if (weatherRes.ok) {
            const weatherData = await weatherRes.json();
            if (weatherData.daily && weatherData.daily.weather_code && weatherData.daily.weather_code.length > 0) {
              weather = weatherCodeToText(weatherData.daily.weather_code[0]);
              temperature = weatherData.daily.temperature_2m_max ? weatherData.daily.temperature_2m_max[0] : null;
            }
          }
        } catch (weatherError) {
          console.error("Failed to fetch weather:", weatherError);
        }
      }

      const res = await fetch(`${API_URL}/api/fields/${selectedField.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: selectedStatus, worker: workerName, weather, temperature })
      });
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        showToast("更新に失敗しました", "error");
        return;
      }
      
      const data = await res.json();
      setFields(fields.map(f => f.id === data.field.id ? data.field : f));
      setSelectedField(data.field);
      setSelectedFieldCenter(getFieldCenter(data.field));
      fetchRecords(data.field.id);
      setSelectedStatus(null); // 選択状態をリセット
      showToast("作業状況を更新しました", "success");
    } catch (error) {
      console.error("Failed to update status:", error);
      showToast("更新に失敗しました", "error");
    }
  };

  const handleRecordClick = (record: WorkRecord) => {
    setEditingRecordId(record.id);
    setEditRecordDate(new Date(record.date).toISOString().split('T')[0]);
    setEditRecordWorker(record.worker || "");
    setEditRecordStatus(record.workType);
  };

  const handleUpdateRecord = async () => {
    if (!editingRecordId || !editRecordStatus) return;
    try {
      const res = await fetch(`${API_URL}/api/records/${editingRecordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: editRecordDate,
          workType: editRecordStatus,
          worker: editRecordWorker
        })
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        showToast("更新に失敗しました", "error");
        return;
      }
      const data = await res.json();
      if (data.field && selectedField) {
        setFields(fields.map(f => f.id === data.field.id ? data.field : f));
        setSelectedField(data.field);
        setSelectedFieldCenter(getFieldCenter(data.field));
      }
      fetchRecords(selectedField!.id);
      setEditingRecordId(null);
      showToast("履歴を更新しました", "success");
    } catch (error) {
      console.error("Failed to update record:", error);
      showToast("更新に失敗しました", "error");
    }
  };

  const handleCancelEditRecord = () => {
    setEditingRecordId(null);
    setEditRecordDate("");
    setEditRecordWorker("");
    setEditRecordStatus(null);
  };

  const handleDeleteRecordClick = (record: WorkRecord) => {
    setRecordToDelete(record);
  };

  const handleDeleteRecordConfirm = async () => {
    if (!recordToDelete || !token) return;
    try {
      const res = await fetch(`${API_URL}/api/records/${recordToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(records.filter(r => r.id !== recordToDelete.id));

        if (data.field) {
          setFields(fields.map(f => f.id === data.field.id ? data.field : f));
          if (selectedField && selectedField.id === data.field.id) {
            setSelectedField(data.field);
            setSelectedFieldCenter(getFieldCenter(data.field));
          }
        }
        setRecordToDelete(null);
      } else {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        showToast("削除に失敗しました", "error");
      }
    } catch (error) {
      console.error("Failed to delete record:", error);
      showToast("削除に失敗しました", "error");
    }
  };

  const handleDeleteFieldClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteFieldConfirm = async () => {
    if (!selectedField || !token) return;
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`${API_URL}/api/fields/${selectedField.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setSelectedField(null);
        setSelectedFieldCenter(null);
        setRecords([]);
        await fetchFields();
      } else {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        showToast("削除に失敗しました", "error");
      }
    } catch (error) {
      console.error("Failed to delete field:", error);
      showToast("削除に失敗しました。通信環境をご確認ください。", "error");
    }
  };

  const handleMapClick = (latlng: LatLngTuple) => {
    if (isCreating) {
      setNewPolygonPoints([...newPolygonPoints, latlng]);
    }
  };

  const handleMarkerDrag = (index: number, newLatLng: LatLngTuple) => {
    const updatedPoints = [...newPolygonPoints];
    updatedPoints[index] = newLatLng;
    setNewPolygonPoints(updatedPoints);
  };

  const handleMarkerRemove = (index: number) => {
    const updatedPoints = newPolygonPoints.filter((_, i) => i !== index);
    setNewPolygonPoints(updatedPoints);
  };

  const handleInsertPoint = (index: number, latlng: LatLngTuple) => {
    const updatedPoints = [...newPolygonPoints];
    updatedPoints.splice(index + 1, 0, latlng);
    setNewPolygonPoints(updatedPoints);
  };

  const handleCreateField = async () => {
    if (newPolygonPoints.length < 3 || !newFieldName) return;

    const parsedArea = Number(newFieldArea);
    const areaValue = newFieldArea !== "" && !Number.isNaN(parsedArea) ? parsedArea : null;

    const coordinates = [
      [...newPolygonPoints.map(p => [p[1], p[0]]), [newPolygonPoints[0][1], newPolygonPoints[0][0]]]
    ];

    const payload = {
      name: newFieldName,
      owner: newFieldOwner,
      status: "未着手",
      area: areaValue,
      polygon: {
        type: "Polygon",
        coordinates
      }
    };

    try {
      const res = await fetch(`${API_URL}/api/fields`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        await fetchFields();
        setIsCreating(false);
        setNewPolygonPoints([]);
        setNewFieldName("");
        setNewFieldOwner("");
        setNewFieldArea("");
        showToast("田んぼを登録しました", "success");
      } else {
        console.error("Failed to save field:", await res.text());
        showToast("登録に失敗しました。サーバーログを確認してください。", "error");
      }
    } catch (error) {
      console.error("Failed to create field:", error);
      showToast("登録に失敗しました。通信エラーの可能性があります。", "error");
    }
  };

  // 住所検索
  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search failed:", error);
      showToast("検索に失敗しました", "error");
    } finally {
      setIsSearching(false);
    }
  };

  // 現在地取得
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast("お使いのブラウザは位置情報をサポートしていません", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapAction({ 
            type: 'flyTo', 
            center: [position.coords.latitude, position.coords.longitude], 
            zoom: 16 
        });
        showToast("現在地に移動しました", "success");
      },
      () => {
        showToast("現在地を取得できませんでした", "error");
      }
    );
  };

  // 自宅の設定開始
  const startSetHome = () => {
      setIsSettingHome(true);
      // 現在の地図の中心位置にピンを配置
      const centerPos = currentMapCenter;
      setTempHomeLocation(centerPos);
      // 地図の中心位置に移動（ピンが画面の真ん中に来るように、ズームレベルは維持）
      setMapAction({
        type: 'flyTo',
        center: centerPos,
        zoom: null // nullを指定すると現在のズームレベルを維持
      });
      setSelectedField(null); // 詳細パネルを閉じる
      setSelectedFieldCenter(null);
      // SP時のみサイドバーを閉じる
      if (window.innerWidth <= 1024) {
        setIsMobileSidebarOpen(false);
      }
      setIsCreating(false); // 登録モードも閉じる
  };

  // 自宅の設定保存
  const saveHome = () => {
      if (tempHomeLocation && user && user.id) {
          try {
            setHomeLocation(tempHomeLocation);
            localStorage.setItem(`nouka_map_home_${user.id}`, JSON.stringify(tempHomeLocation));
            setIsSettingHome(false);
            setTempHomeLocation(null);
            showToast("自宅を保存しました", "success");
          } catch (error) {
            console.error("Failed to save home location:", error);
            showToast("自宅の保存に失敗しました", "error");
          }
      } else {
        showToast("自宅の保存に失敗しました（ユーザー情報が不正です）", "error");
      }
  };

  // 自宅の設定キャンセル
  const cancelSetHome = () => {
      setIsSettingHome(false);
      setTempHomeLocation(null);
  };

  // 自宅へ移動
  const handleGoHome = () => {
      if (homeLocation) {
          // オブジェクトを新しく作り直してセットすることでuseEffectを発火させる
          setMapAction({ 
              type: 'flyTo', 
              center: homeLocation, 
              zoom: 18 // ズームレベルを上げて拡大表示
          }); 
      } else {
          showToast("自宅が設定されていません。", "info");
      }
  };

  const midpoints = useMemo(() => {
    if (!isCreating || newPolygonPoints.length < 2) return [];
    
    return newPolygonPoints.map((point, i) => {
      const nextPoint = newPolygonPoints[(i + 1) % newPolygonPoints.length];
      const midLat = (point[0] + nextPoint[0]) / 2;
      const midLng = (point[1] + nextPoint[1]) / 2;
      return { latlng: [midLat, midLng] as LatLngTuple, insertIndex: i };
    });
  }, [isCreating, newPolygonPoints]);

  // 田んぼリストを名前順（あいうえお順）でソート
  const sortedFields = useMemo(() => {
    if (!Array.isArray(fields)) return [];
    return [...fields].sort((a, b) => {
      // 名前で比較（あいうえお順）
      return a.name.localeCompare(b.name, 'ja');
    });
  }, [fields]);

  const totalArea = useMemo(
    () => Array.isArray(fields) ? fields.reduce((sum, field) => sum + (field.area ?? 0), 0) : 0,
    [fields]
  );
  const totalAreaLabel = formatAreaLabel(totalArea);

  // 認証チェック
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>読み込み中...</div>
      </div>
    );
  }

  if (!user || !token) {
    return <Auth />;
  }

  return (
    <div className="App">
      {/* モバイル用トグルボタン */}
      <button 
        className={`mobile-menu-toggle ${isMobileSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        aria-label="メニューを開く"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* サイドバーが開いているときのオーバーレイ */}
      {isMobileSidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className={`sidebar ${isMobileSidebarOpen ? 'open' : ''} ${isSettingHome ? 'home-setting-hidden-pc' : ''} ${selectedField ? 'has-detail' : ''}`} ref={sidebarRef}>
        <div className="sidebar-header">
          <h1>工程管理くん</h1>
          <div className="header-user-row">
            <div className="user-info">
              <span className="username">{user?.username}</span>
            </div>
            <button onClick={logout} className="logout-btn">
              ログアウト
            </button>
          </div>
        </div>
        
        <div className="sidebar-content">
        {/* 検索・現在地エリア（新規登録時・編集時・選択時・リスト開いている時は非表示、自宅設定時は表示） */}
        {!isCreating && !isEditingField && !selectedField && (isFieldListCollapsed || fields.length === 0) && (
        <div className={`search-section ${isSettingHome ? 'home-setting-search' : ''}`}>
          <div className="search-box">
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="住所・地名で検索"
            />
            <button onClick={handleSearch} disabled={isSearching}>🔍</button>
          </div>
          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map((result) => (
                <li key={result.place_id} onClick={() => {
                  setMapAction({
                      type: 'flyTo',
                      center: [parseFloat(result.lat), parseFloat(result.lon)],
                      zoom: 16
                  });
                  setSearchResults([]); 
                  setIsMobileSidebarOpen(false); // 検索したら閉じる
                }}>
                  {result.display_name}
                </li>
              ))}
            </ul>
          )}
          <div className="location-buttons">
            <button className="locate-btn" onClick={() => { handleLocateMe(); setIsMobileSidebarOpen(false); }}>📍 現在地</button>
            <button className="home-btn" onClick={() => { handleGoHome(); setIsMobileSidebarOpen(false); }} disabled={!homeLocation}>🏠 自宅へ</button>
          </div>
          <div style={{textAlign: 'right', marginTop: '5px'}}>
              {!isSettingHome ? (
                <button className="text-btn" onClick={startSetHome}>
                    {isMobileSidebarOpen && homeLocation ? '自宅の位置を変更' : '自宅を設定'}
                </button>
              ) : (
                <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center'}}>
                   <span style={{fontSize: '0.8rem', color: '#666'}}>ピンを移動して</span>
                   <button className="text-btn" onClick={saveHome} style={{fontWeight: 'bold', color: 'var(--primary-color)'}}>保存</button>
                   <button className="text-btn" onClick={cancelSetHome} style={{color: '#999'}}>キャンセル</button>
                </div>
              )}
          </div>
        </div>
        )}

        {!isSettingHome && !isCreating && fields.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🌾</div>
            <h3>田んぼが登録されていません</h3>
            <p>
              「+ 田んぼを登録する」ボタンから<br/>
              あなたの田んぼを登録しましょう
            </p>
          </div>
        )}

        {!isSettingHome && fields.length > 0 && (
          <div className={`field-list ${isFieldListCollapsed ? "collapsed" : ""}`}>
            <div className="field-list-header">
              <div className="field-list-header-top">
                <h3>登録済みの田んぼ</h3>
                <button
                  className="text-btn"
                  onClick={() => setIsFieldListCollapsed(!isFieldListCollapsed)}
                >
                  {isFieldListCollapsed ? "開く" : "閉じる"}
                </button>
              </div>
              <div className="field-list-info">
                <span className="field-count">{fields.length.toString().replace(/[0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0))}件</span>
                <span className="field-total">
                  合計: {totalAreaLabel ?? "0a (0反 / 0ha)"}
                </span>
              </div>
            </div>
            {!isFieldListCollapsed && (
              <ul>
                {sortedFields.map(field => {
                  const areaLabel = formatAreaLabel(field.area);
                  return (
                    <li 
                      key={field.id} 
                      className={`field-list-item ${selectedField?.id === field.id ? "active" : ""}`}
                      onClick={() => handleSelectField(field)}
                    >
                      <div className="field-list-main">
                        <span className="field-name">{field.name}</span>
                        {areaLabel && (
                          <span className="field-area">{areaLabel}</span>
                        )}
                      </div>
                      <span 
                        className="field-status-badge"
                        style={{ backgroundColor: STATUS_COLORS[field.status] }}
                      >
                        {field.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* PC表示時はサイドバー内に登録パネルを表示 */}
        {isCreating && (
          <div className="create-panel create-panel-inline">
            <h3>新規田んぼ登録</h3>
            <p className="hint-text">
                ・田んぼの輪郭を囲むようにピンを配置してください<br/>
                ・ピンをドラッグで移動<br/>
                ・半透明のピンをクリックして追加
            </p>
            <input 
              placeholder="田んぼの名前" 
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
            />
            <input 
              placeholder="所有者名" 
              value={newFieldOwner}
              onChange={e => setNewFieldOwner(e.target.value)}
            />
            <input
              type="number"
              placeholder="面積 (例: 20a)"
              value={newFieldArea}
              onChange={e => setNewFieldArea(e.target.value)}
              min="0"
              step="1"
            />
            <p className="area-note">※ 1反 = 10a / 1ha = 100a</p>
            <div className="button-group">
              <button onClick={handleCreateField} disabled={newPolygonPoints.length < 3}>登録</button>
              <button onClick={() => {
                setIsCreating(false);
                setNewPolygonPoints([]);
                setNewFieldName("");
                setNewFieldOwner("");
                setNewFieldArea("");
              }}>キャンセル</button>
            </div>
          </div>
        )}

        {/* 登録パネル（サイドバーの外に配置、モバイル表示時はフローティングパネル） */}
        {isCreating && (
          <div className="create-panel-floating">
            <div className="create-panel">
              <h3>新規田んぼ登録</h3>
              <p className="hint-text">
                  ・田んぼの輪郭を囲むようにピンを配置してください<br/>
                  ・ピンをドラッグで移動<br/>
                  ・半透明のピンをクリックして追加
              </p>
              <input 
                placeholder="田んぼの名前" 
                value={newFieldName}
                onChange={e => setNewFieldName(e.target.value)}
              />
              <input 
                placeholder="所有者名" 
                value={newFieldOwner}
                onChange={e => setNewFieldOwner(e.target.value)}
              />
              <input
                type="number"
                placeholder="面積 (例: 20a)"
                value={newFieldArea}
                onChange={e => setNewFieldArea(e.target.value)}
                min="0"
                step="1"
              />
              <p className="area-note">※ 1反 = 10a / 1ha = 100a</p>
              <div className="button-group">
                <button onClick={handleCreateField} disabled={newPolygonPoints.length < 3}>登録</button>
                <button onClick={() => {
                  setIsCreating(false);
                  setNewPolygonPoints([]);
                  setNewFieldName("");
                  setNewFieldOwner("");
                  setNewFieldArea("");
                }}>キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {/* 自宅設定パネル（サイドバーの外に配置、PC・モバイル両方でフローティングパネル、下に表示） */}
        {isSettingHome && (
          <div className="home-setting-floating">
            <div className="create-panel home-setting-panel">
              <h3>🏠 自宅の位置を設定</h3>
              <p className="hint-text">
                ピンクのピンを自宅に設定したい場所にドラッグして移動してください。<br/>
                地図上でピンの位置を調整できます。
              </p>
              <div className="button-group">
                <button onClick={saveHome} style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
                  保存
                </button>
                <button onClick={cancelSetHome} style={{ backgroundColor: '#999', color: 'white' }}>
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedField && !isCreating && !isSettingHome && (
          <div className="detail-panel">
            <button className="back-btn" onClick={() => {
              setSelectedField(null);
              setSelectedFieldCenter(null);
              setIsEditingField(false);
            }}>詳細を閉じる</button>
            
            {!isEditingField ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h2 className="detail-title" style={{ margin: 0 }}>{selectedField.name}</h2>
                  <button 
                    onClick={() => setIsEditingField(true)}
                    className="edit-btn"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    編集
                  </button>
                </div>
                <p>所有者: {selectedField.owner || '未設定'}</p>
                {(() => {
                  const detailAreaLabel = formatAreaLabel(selectedField.area);
                  return detailAreaLabel ? <p>面積: {detailAreaLabel}</p> : <p>面積: 未設定</p>;
                })()}
              </>
            ) : (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <h3 style={{ margin: '0 0 15px 0' }}>田んぼ情報を編集</h3>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: '600' }}>田んぼの名前</label>
                    <input
                      type="text"
                      value={editFieldName}
                      onChange={e => setEditFieldName(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: '600' }}>所有者</label>
                    <input
                      type="text"
                      value={editFieldOwner}
                      onChange={e => setEditFieldOwner(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: '600' }}>面積 (a)</label>
                    <input
                      type="number"
                      value={editFieldArea}
                      onChange={e => setEditFieldArea(e.target.value)}
                      placeholder="例: 20"
                      min="0"
                      step="1"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                    <p className="area-note" style={{ marginTop: '5px' }}>※ 1反 = 10a / 1ha = 100a</p>
                  </div>
                  <div className="button-group">
                    <button onClick={handleUpdateField} style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
                      保存
                    </button>
                    <button onClick={() => {
                      setIsEditingField(false);
                      setEditFieldName(selectedField.name);
                      setEditFieldOwner(selectedField.owner || "");
                      setEditFieldArea(selectedField.area?.toString() || "");
                    }} style={{ backgroundColor: '#999', color: 'white' }}>
                      キャンセル
                    </button>
                  </div>
                </div>
              </>
            )}
            
            <p>現在の状態: <span style={{color: STATUS_COLORS[selectedField.status], fontWeight: 'bold'}}>{selectedField.status}</span></p>

            <div className="status-actions">
              <h4>作業状況を更新</h4>
              <div style={{marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <label style={{fontSize: '0.9rem', whiteSpace: 'nowrap'}}>作業日: </label>
                      <input 
                        type="date" 
                        value={workDate} 
                        onChange={e => setWorkDate(e.target.value)}
                        style={{padding: '8px 10px', flex: 1, minWidth: 0}}
                      />
                  </div>
                  <div className="worker-input-group" style={{display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f9f9f9', padding: '10px 12px', borderRadius: '8px'}}>
                      <label style={{fontSize: '0.9rem', whiteSpace: 'nowrap'}}>作業者名: </label>
                      <input 
                        type="text" 
                        value={workerName} 
                        onChange={e => setWorkerName(e.target.value)}
                        placeholder="例: 山田太郎"
                        style={{padding: '8px 10px', flex: 1, minWidth: 0, border: '1px solid #ddd', borderRadius: '6px'}}
                      />
                  </div>
              </div>
              <div className="status-buttons">
                {STATUS_LIST.map((status) => (
                  <button 
                    key={status} 
                    className={selectedStatus === status ? 'selected' : ''}
                    style={{backgroundColor: STATUS_COLORS[status], color: 'white'}}
                    onClick={() => handleStatusChange(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button 
                onClick={handleUpdateStatus}
                disabled={!selectedStatus}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: '10px',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedStatus ? 'pointer' : 'not-allowed',
                  opacity: selectedStatus ? 1 : 0.5,
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                更新
              </button>
            </div>

            <div className="history">
              <h4>作業履歴 ({new Date().getFullYear()}年度)</h4>
              <ul>
                {records.map(record => (
                  <li key={record.id} className={`history-item field-list-item ${editingRecordId === record.id ? 'editing' : ''}`}>
                    {editingRecordId === record.id ? (
                      <div className="history-edit-form" style={{width: '100%'}}>
                        <div style={{marginBottom: '10px'}}>
                          <label style={{display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: '600'}}>作業日</label>
                          <input
                            type="date"
                            value={editRecordDate}
                            onChange={e => setEditRecordDate(e.target.value)}
                            style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box'}}
                          />
                        </div>
                        <div className="worker-input-group" style={{marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f9f9f9', padding: '10px 12px', borderRadius: '8px', boxSizing: 'border-box', minWidth: 0, width: '100%'}}>
                          <label style={{fontSize: '0.85rem', whiteSpace: 'nowrap'}}>作業者名: </label>
                          <input
                            type="text"
                            value={editRecordWorker}
                            onChange={e => setEditRecordWorker(e.target.value)}
                            placeholder="例: 山田太郎"
                            style={{padding: '8px', flex: 1, minWidth: 0, maxWidth: '100%', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box'}}
                          />
                        </div>
                        <div style={{marginBottom: '10px'}}>
                          <label style={{display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: '600'}}>作業内容</label>
                          <div className="status-buttons">
                            {STATUS_LIST.map((status) => (
                              <button
                                key={status}
                                className={editRecordStatus === status ? 'selected' : ''}
                                style={{backgroundColor: STATUS_COLORS[status], color: 'white', padding: '8px', fontSize: '0.8rem'}}
                                onClick={() => setEditRecordStatus(status)}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{display: 'flex', gap: '8px', marginTop: '10px'}}>
                          <button
                            onClick={handleUpdateRecord}
                            style={{flex: 1, padding: '8px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem'}}
                          >
                            更新
                          </button>
                          <button
                            onClick={handleCancelEditRecord}
                            style={{flex: 1, padding: '8px', backgroundColor: '#999', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem'}}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, cursor: 'pointer'}} onClick={() => handleRecordClick(record)}>
                          <span className="history-date-work">{new Date(record.date).toLocaleDateString()} - {record.workType}</span>
                          <div style={{display: 'flex', gap: '10px', fontSize: '0.8rem', color: '#666', marginTop: '4px'}}>
                            {record.worker && <span className="history-worker">作業者: {record.worker}</span>}
                            {record.weather && (
                              <span className="history-weather">
                                {record.weather}
                                {record.temperature !== null && record.temperature !== undefined && ` ${record.temperature.toFixed(1)}°C`}
                              </span>
                            )}
                          </div>
                        </div>
                        <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteRecordClick(record); }}>×</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <button className="danger-btn" onClick={handleDeleteFieldClick}>
              田んぼを削除する
            </button>
          </div>
        )}
        </div>

        {/* 田んぼを登録するボタン（サイドバーの一番下に固定） */}
        {!isCreating && !selectedField && !isSettingHome && (
          <button onClick={() => {
            setIsCreating(true);
            // スマホ表示の時にサイドバーを閉じる
            if (window.innerWidth <= 1024) {
              setIsMobileSidebarOpen(false);
            }
          }} className="create-btn">
            + 田んぼを登録する
          </button>
        )}
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && selectedField && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>本当に削除しますか？</h3>
            <p>「{selectedField.name}」を削除しますか？</p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px' }}>
              関連する作業履歴もすべて削除されます。
            </p>
            <div className="button-group" style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleDeleteFieldConfirm}
                style={{ 
                  flex: 1, 
                  backgroundColor: '#ff6b6b', 
                  color: 'white',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                削除する
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                style={{ 
                  flex: 1, 
                  backgroundColor: '#999', 
                  color: 'white',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 作業履歴削除確認モーダル */}
      {recordToDelete && (
        <div className="modal-overlay" onClick={() => setRecordToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>本当に削除しますか？</h3>
            <p>「{new Date(recordToDelete.date).toLocaleDateString()} - {recordToDelete.workType}」の作業履歴を削除しますか？</p>
            <div className="button-group" style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleDeleteRecordConfirm}
                style={{ 
                  flex: 1, 
                  backgroundColor: '#ff6b6b', 
                  color: 'white',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                削除する
              </button>
              <button 
                onClick={() => setRecordToDelete(null)}
                style={{ 
                  flex: 1, 
                  backgroundColor: '#999', 
                  color: 'white',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="map-container">
        <MapContainer
          center={[35.6812, 139.7671]}
          zoom={16}
          maxZoom={21}
          minZoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="国土地理院 写真">
              <TileLayer
                attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
                url="https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
                maxZoom={21}
                maxNativeZoom={18}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="国土地理院 標準">
              <TileLayer
                attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
                url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
                maxZoom={21}
                maxNativeZoom={18}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={21}
                maxNativeZoom={19}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <MapController action={mapAction} />
          <MapCenterListener onCenterChanged={setCurrentMapCenter} />
          <MapClickHandler onClick={handleMapClick} />
          
          {/* 自宅マーカー（設定済みの場合） */}
          {homeLocation && !isSettingHome && (
              <Marker position={homeLocation} icon={HomeIcon}>
                  <Popup>自宅</Popup>
              </Marker>
          )}

          {/* 選択中田んぼの目印 */}
          {selectedField && selectedFieldCenter && !isSettingHome && (
              <Marker position={selectedFieldCenter} icon={SelectedFieldIcon}>
                  <Popup>{selectedField.name}</Popup>
              </Marker>
          )}

          {/* 自宅設定中の仮マーカー（ドラッグ可能） */}
          {isSettingHome && tempHomeLocation && (
              <DraggableMarker 
                  position={tempHomeLocation} 
                  index={-1} // ダミーインデックス
                  onDragEnd={(_, pos) => setTempHomeLocation(pos)}
                  onRemove={() => {}} // 削除不可
                  icon={HomeSettingIcon} // 設定中はピンクのピンを使用
              />
          )}

          {fields.map(field => {
            const polygonCoords = field.polygon?.coordinates;
            if (!polygonCoords || !Array.isArray(polygonCoords) || polygonCoords.length === 0) return null;
            
            const positions: LatLngTuple[] = polygonCoords[0].map((coord: number[]) => [coord[1], coord[0]]);
            
            return (
              <Polygon 
                key={field.id}
                positions={positions}
                pathOptions={{ 
                  color: STATUS_COLORS[field.status], 
                  fillColor: STATUS_COLORS[field.status], 
                  fillOpacity: 0.5 
                }}
                eventHandlers={{
                  click: (e) => {
                    LeafletMouseEvent;
                    e.originalEvent.stopPropagation();
                    if (!isCreating && !isSettingHome) handleSelectField(field);
                  }
                }}
              />
            );
          })}

          {isCreating && (
            <>
              {newPolygonPoints.map((p, i) => (
                <DraggableMarker 
                  key={`marker-${i}`} 
                  position={p} 
                  index={i}
                  onDragEnd={handleMarkerDrag}
                  onRemove={handleMarkerRemove}
                />
              ))}
              
              {midpoints.map((m, i) => (
                <Marker
                  key={`midpoint-${i}`}
                  position={m.latlng}
                  icon={MidpointIcon}
                  opacity={0.5}
                  eventHandlers={{
                    click: (e) => {
                      e.originalEvent.stopPropagation();
                      handleInsertPoint(m.insertIndex, m.latlng);
                    }
                  }}
                />
              ))}

              <Polygon positions={newPolygonPoints} pathOptions={{ color: 'red', dashArray: '5, 5' }} />
            </>
          )}
        </MapContainer>
      </div>
      <ToastContainer />
    </div>
  );
}

// ドラッグ可能・削除可能なマーカーコンポーネント
function DraggableMarker({ position, index, onDragEnd, onRemove, icon = DefaultIcon }: { 
    position: LatLngTuple, 
    index: number, 
    onDragEnd: (index: number, pos: LatLngTuple) => void,
    onRemove: (index: number) => void,
    icon?: Icon
}) {
  const eventHandlers = useMemo(
    () => ({
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const latlng = marker.getLatLng();
          onDragEnd(index, [latlng.lat, latlng.lng]);
        }
      },
      contextmenu() {
        onRemove(index);
      }
    }),
    [index, onDragEnd, onRemove],
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      icon={icon}
    />
  )
}

export default App;
