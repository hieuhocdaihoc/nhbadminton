import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Sửa lỗi icon mặc định của Leaflet bị vỡ khi build qua Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER = [10.7769, 106.7009]; // TP. Hồ Chí Minh

// Component bản đồ miễn phí (OpenStreetMap) cho phép click/kéo ghim để chọn tọa độ.
// Địa chỉ gợi ý tự động có thể không chính xác ở vùng nông thôn (ấp/xã) -
// admin nên kiểm tra và sửa lại chữ địa chỉ cho đúng sau khi chọn vị trí.
const LocationPicker = ({ lat, lng, onPick }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    const initialCenter =
      lat && lng ? [parseFloat(lat), parseFloat(lng)] : DEFAULT_CENTER;

    const map = L.map(mapRef.current).setView(initialCenter, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(initialCenter, { draggable: true }).addTo(map);

    const handlePositionChange = async (latlng) => {
      marker.setLatLng(latlng);
      setIsLookingUp(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&accept-language=vi`,
        );
        const data = await res.json();
        onPick({
          lat: latlng.lat,
          lng: latlng.lng,
          address: data?.display_name || null,
        });
      } catch (error) {
        onPick({ lat: latlng.lat, lng: latlng.lng, address: null });
      } finally {
        setIsLookingUp(false);
      }
    };

    map.on("click", (e) => handlePositionChange(e.latlng));
    marker.on("dragend", () => handlePositionChange(marker.getLatLng()));

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full h-[280px] rounded-lg overflow-hidden border border-zinc-200"
      />
      {isLookingUp && (
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] font-medium text-zinc-600 shadow flex items-center gap-1.5">
          <span className="w-3 h-3 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          Đang dò địa chỉ...
        </div>
      )}
      <p className="text-[10px] text-amber-600 mt-1.5">
        ⚠️ Click hoặc kéo ghim để chọn đúng vị trí. Địa chỉ tự dò có thể chưa
        chính xác (đặc biệt khu vực ấp/xã) — hãy kiểm tra và sửa lại chữ địa
        chỉ bên dưới cho đúng trước khi lưu.
      </p>
    </div>
  );
};

export default LocationPicker;
