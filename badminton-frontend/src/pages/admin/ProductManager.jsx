import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminProductService } from "../../services/admin/productService";
import { adminCategoryService } from "../../services/admin/categoryService";
import { imageService } from "../../services/admin/imageService";

const ProductManager = () => {
  const [activeTab, setActiveTab] = useState("list");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  // --- DANH MỤC ---
  const [catForm, setCatForm] = useState({ id: null, name: "", description: "", status: "active" });
  const [isCatEditing, setIsCatEditing] = useState(false);
  const [isCatProcessing, setIsCatProcessing] = useState(false);
  const [catMessage, setCatMessage] = useState({ type: "", text: "" });

  const fetchCategories = async () => {
    try {
      const res = await adminCategoryService.getCategories();
      setCategories(res.data?.data || []);
    } catch (e) {
      console.error("Lỗi tải danh mục:", e);
    }
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    setIsCatProcessing(true);
    setCatMessage({ type: "", text: "" });
    try {
      if (isCatEditing) {
        await adminCategoryService.updateCategory(catForm.id, { name: catForm.name, description: catForm.description, status: catForm.status });
        setCatMessage({ type: "success", text: "Cập nhật thành công!" });
      } else {
        await adminCategoryService.createCategory({ name: catForm.name, description: catForm.description, status: catForm.status });
        setCatMessage({ type: "success", text: "Thêm mới thành công!" });
      }
      resetCatForm();
      fetchCategories();
    } catch (err) {
      setCatMessage({ type: "error", text: err.response?.data?.message || "Có lỗi xảy ra!" });
    } finally {
      setIsCatProcessing(false);
      setTimeout(() => setCatMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleCatEdit = (c) => {
    setIsCatEditing(true);
    setCatForm({ id: c.id, name: c.name, description: c.description || "", status: c.status });
  };

  const handleCatDelete = async (c) => {
    if (!window.confirm(`Tạm ẩn danh mục [${c.name}]?`)) return;
    try {
      await adminCategoryService.deleteCategory(c.id);
      setCatMessage({ type: "success", text: "Đã tạm ẩn danh mục!" });
      fetchCategories();
    } catch {
      setCatMessage({ type: "error", text: "Thao tác thất bại!" });
    } finally {
      setTimeout(() => setCatMessage({ type: "", text: "" }), 2500);
    }
  };

  const resetCatForm = () => {
    setCatForm({ id: null, name: "", description: "", status: "active" });
    setIsCatEditing(false);
  };

  const [report, setReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const fetchReport = async () => {
    setIsLoadingReport(true);
    try {
      const res = await adminProductService.getReport();
      setReport(res.data?.data || null);
    } catch (error) {
      console.error("Không thể tải báo cáo tồn kho:", error);
    } finally {
      setIsLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === "report" && !report) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
  });
  const [stats, setStats] = useState({ total: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  const [form, setForm] = useState({
    id: null,
    category_id: "",
    name: "",
    sku: "",
    brand: "",
    selling_price: "",
    low_stock_threshold: 5,
    description: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [productImages, setProductImages] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState(null);
  const imageInputRef = useRef(null);

  const loadInitData = async () => {
    await fetchCategories();
  };

  const fetchProducts = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await adminProductService.getProducts(
        page,
        searchKeyword,
        selectedCategoryFilter,
      );
      const serverData = res.data?.data;
      setProducts(serverData?.data || []);
      setPagination({
        current_page: serverData?.current_page || 1,
        last_page: serverData?.last_page || 1,
      });
      setStats(res.data?.stats || { total: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 });
    } catch (error) {
      setMessage({ type: "error", text: "Không thể tải danh sách sản phẩm." });
    } finally {
      setIsLoading(false);
    }
  };

  // Tải dữ liệu nền đúng một lần khi trang được mở.
  useEffect(() => {
    loadInitData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Từ khóa chỉ được áp dụng khi người dùng gửi biểu mẫu tìm kiếm.
  useEffect(() => {
    fetchProducts(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.category_id ||
      !form.name.trim() ||
      !form.sku.trim() ||
      form.selling_price === ""
    )
      return;
    setIsProcessing(true);
    setMessage({ type: "", text: "" });

    const payload = {
      category_id: form.category_id,
      name: form.name,
      sku: form.sku,
      brand: form.brand,
      selling_price: Number(form.selling_price),
      low_stock_threshold: Number(form.low_stock_threshold || 5),
      description: form.description,
    };

    try {
      if (isEditing) {
        await adminProductService.updateProduct(form.id, payload);
        setMessage({ type: "success", text: "Cập nhật thành công!" });
        resetForm();
      } else {
        const res = await adminProductService.createProduct(payload);
        const newProduct = res.data?.data;
        let uploadedImage = null;

        // Nếu admin đã chọn ảnh trước khi lưu, upload luôn ảnh đó cho sản phẩm vừa tạo
        if (newProduct?.id && pendingImageFile) {
          try {
            const imgRes = await imageService.upload(
              pendingImageFile,
              "product",
              newProduct.id,
              true,
            );
            uploadedImage = imgRes.data?.data;
          } catch (imgErr) {
            setMessage({
              type: "error",
              text: "Tạo sản phẩm thành công nhưng tải ảnh thất bại, bạn có thể thử lại bên dưới.",
            });
          }
        }

        if (!pendingImageFile || uploadedImage) {
          setMessage({ type: "success", text: "Thêm sản phẩm thành công!" });
        }

        // Chuyển sang chế độ sửa để xem/quản lý ảnh vừa tải lên
        if (newProduct?.id) {
          handleEditClick({
            ...newProduct,
            images: uploadedImage ? [uploadedImage] : [],
          });
        } else {
          resetForm();
        }
      }
      fetchProducts(pagination.current_page);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Có lỗi xảy ra!",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleEditClick = (product) => {
    setIsEditing(true);
    setForm({
      id: product.id,
      category_id: product.category_id,
      name: product.name,
      sku: product.sku,
      brand: product.brand || "",
      selling_price: product.selling_price,
      low_stock_threshold: product.low_stock_threshold,
      description: product.description || "",
    });
    setProductImages(product.images || []);
    setPendingImageFile(null);
    setPendingImagePreview(null);
  };

  const handleImageButtonClick = () => {
    imageInputRef.current?.click();
  };

  const validateImageFile = (file) => {
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Vui lòng chọn một tệp hình ảnh." });
      return false;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Ảnh không được vượt quá 2MB." });
      return false;
    }
    return true;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file)) return;

    // Chưa tạo sản phẩm (chưa có id) -> chỉ lưu tạm ảnh để xem trước, upload sau khi lưu thành công
    if (!form.id) {
      setPendingImageFile(file);
      setPendingImagePreview(URL.createObjectURL(file));
      e.target.value = "";
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await imageService.upload(file, "product", form.id, true);
      const newImage = res.data?.data;
      // Ảnh mới là primary nên gỡ primary của các ảnh cũ trên giao diện
      setProductImages((prev) => [
        ...prev.map((img) => ({ ...img, is_primary: false })),
        newImage,
      ]);
      setMessage({ type: "success", text: "Tải ảnh lên thành công!" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Tải ảnh thất bại.",
      });
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleRemovePendingImage = () => {
    setPendingImageFile(null);
    setPendingImagePreview(null);
  };

  const handleImageDelete = async (image) => {
    if (!window.confirm("Xóa ảnh này?")) return;
    try {
      await imageService.remove(image.id);
      setProductImages((prev) => prev.filter((img) => img.id !== image.id));
    } catch (error) {
      setMessage({ type: "error", text: "Xóa ảnh thất bại." });
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleDeleteClick = async (product) => {
    if (window.confirm(`Bạn có chắc muốn tạm dừng bán [${product.name}]?`)) {
      try {
        await adminProductService.deleteProduct(product.id);
        setMessage({ type: "success", text: "Đã tạm dừng kinh doanh!" });
        fetchProducts(pagination.current_page);
      } catch (e) {
        setMessage({ type: "error", text: "Thao tác thất bại!" });
      } finally {
        setTimeout(() => setMessage({ type: "", text: "" }), 2500);
      }
    }
  };

  const handleRestoreClick = async (product) => {
    if (
      window.confirm(`Kích hoạt mở bán lại cho sản phẩm [${product.name}]?`)
    ) {
      try {
        await adminProductService.restoreProduct(product.id);
        setMessage({ type: "success", text: "Đã khôi phục hoạt động!" });
        fetchProducts(pagination.current_page);
      } catch (e) {
        setMessage({ type: "error", text: "Kích hoạt lại thất bại!" });
      } finally {
        setTimeout(() => setMessage({ type: "", text: "" }), 2500);
      }
    }
  };

  const resetForm = () => {
    setForm({
      id: null,
      category_id: "",
      name: "",
      sku: "",
      brand: "",
      selling_price: "",
      low_stock_threshold: 5,
      description: "",
    });
    setIsEditing(false);
    setProductImages([]);
    setPendingImageFile(null);
    setPendingImagePreview(null);
  };

  const inputClass =
    "admin-input";

  return (
    <div className="admin-page-container">
      {/* TIÊU ĐỀ */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">
            Quản lý sản phẩm
          </h2>
          <p className="admin-page-subtitle">
            Thiết lập giá bán lẻ và theo dõi tồn kho
          </p>
        </div>
        <div className="admin-stat-group">
          <div className="admin-stat-badge badge-default">
            <p className="admin-stat-value val-default">{stats.total}</p>
            <p className="admin-stat-label lbl-default">Tổng sản phẩm</p>
          </div>
          <div className="admin-stat-badge badge-success">
            <p className="admin-stat-value val-success">{stats.in_stock}</p>
            <p className="admin-stat-label lbl-success">Còn hàng</p>
          </div>
          {stats.low_stock > 0 && (
            <div className="admin-stat-badge badge-warning">
              <p className="admin-stat-value text-amber-600">{stats.low_stock}</p>
              <p className="admin-stat-label text-amber-500">Sắp hết</p>
            </div>
          )}
          {stats.out_of_stock > 0 && (
            <div className="admin-stat-badge badge-danger">
              <p className="admin-stat-value val-danger">{stats.out_of_stock}</p>
              <p className="admin-stat-label lbl-danger">Hết hàng</p>
            </div>
          )}
        </div>
      </div>

      {/* TAB */}
      <div className="flex gap-1 border-b border-zinc-200">
        {[
          { key: "list", label: "Sản phẩm" },
          { key: "categories", label: "Danh mục" },
          { key: "report", label: "Báo cáo tồn kho" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "report" && (
        <div className="space-y-4">
          {isLoadingReport ? (
            <div className="admin-card p-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mb-3" />
              <p className="text-xs text-zinc-400">Đang tải báo cáo...</p>
            </div>
          ) : !report ? (
            <div className="admin-card p-16 text-center text-sm text-zinc-400">Không có dữ liệu báo cáo.</div>
          ) : (
            <>
              <div className="admin-stat-group">
                <div className="admin-stat-badge badge-success">
                  <p className="admin-stat-value val-success">
                    {Number(report.total_inventory_value || 0).toLocaleString()}đ
                  </p>
                  <p className="admin-stat-label lbl-success">Tổng giá trị tồn kho</p>
                </div>
                <div className="admin-stat-badge badge-danger">
                  <p className="admin-stat-value val-danger">{report.needs_restock?.length || 0}</p>
                  <p className="admin-stat-label lbl-danger">Cần nhập thêm</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top bán chạy */}
                <div className="admin-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-zinc-100">
                    <h3 className="text-sm font-medium text-zinc-800">Top bán chạy</h3>
                  </div>
                  <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
                    {(report.top_selling || []).length === 0 ? (
                      <p className="p-5 text-xs text-zinc-400 text-center">Chưa có dữ liệu bán hàng.</p>
                    ) : (
                      report.top_selling.map((p, i) => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-zinc-300 w-4">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-zinc-800 truncate">{p.name}</p>
                              <p className="text-[10px] text-zinc-400">{p.category?.name || "—"}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 shrink-0">{p.sold_count || 0} đã bán</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Cần nhập thêm */}
                <div className="admin-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-zinc-100">
                    <h3 className="text-sm font-medium text-zinc-800">Sắp hết / cần nhập thêm</h3>
                  </div>
                  <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
                    {(report.needs_restock || []).length === 0 ? (
                      <p className="p-5 text-xs text-zinc-400 text-center">Không có sản phẩm nào cần nhập thêm.</p>
                    ) : (
                      report.needs_restock.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-800 truncate">{p.name}</p>
                            <p className="text-[10px] text-zinc-400">{p.category?.name || "—"}</p>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${p.stock_quantity <= 0 ? "text-red-500" : "text-amber-600"}`}>
                            Còn {p.stock_quantity} / ngưỡng {p.low_stock_threshold}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Giá trị tồn kho theo danh mục */}
              <div className="admin-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-100">
                  <h3 className="text-sm font-medium text-zinc-800">Giá trị tồn kho theo danh mục</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-50/60 border-b border-zinc-100">
                      <th className="text-left py-3 px-5">Danh mục</th>
                      <th className="text-right py-3 px-3">Số sản phẩm</th>
                      <th className="text-right py-3 px-5">Giá trị tồn kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.by_category || []).map((c) => (
                      <tr key={c.category_name} className="border-b border-zinc-100 last:border-b-0">
                        <td className="py-3 px-5 text-sm font-medium text-zinc-800">{c.category_name}</td>
                        <td className="py-3 px-3 text-right text-sm text-zinc-600">{c.product_count}</td>
                        <td className="py-3 px-5 text-right text-sm font-semibold text-zinc-800">
                          {Number(c.inventory_value || 0).toLocaleString()}đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "list" && (
        <>
      {/* THÔNG BÁO (TOAST) */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-3 rounded-lg text-xs font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* THANH CÔNG CỤ */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <form
            onSubmit={handleSearchSubmit}
            className="relative w-full sm:w-72"
          >
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Tìm tên hoặc SKU..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="admin-input pl-10 py-2.5"
            />
            <button type="submit" className="hidden"></button>
          </form>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-xs text-zinc-500">Danh mục:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 outline-none focus:border-zinc-400 transition-colors cursor-pointer"
            >
              <option value="">Tất cả</option>
              {categories.filter(c => c.status === "active").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* BẢNG DANH SÁCH (TRÁI) */}
        <div className="lg:col-span-8 admin-card overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5" style={{ width: "240px" }}>
                    Sản phẩm / SKU
                  </th>
                  <th className="py-3 px-3" style={{ width: "120px" }}>
                    Danh mục
                  </th>
                  <th
                    className="py-3 px-3 text-right"
                    style={{ width: "100px" }}
                  >
                    Giá bán
                  </th>
                  <th
                    className="py-3 px-3 text-center"
                    style={{ width: "80px" }}
                  >
                    Tồn kho
                  </th>
                  <th
                    className="py-3 px-3 text-center"
                    style={{ width: "100px" }}
                  >
                    Trạng thái
                  </th>
                  <th
                    className="py-3 px-5 text-right"
                    style={{ width: "120px" }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="py-16 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="py-16 text-center text-xs text-zinc-400"
                    >
                      Không tìm thấy sản phẩm nào
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isLowStock =
                      p.stock_quantity <= p.low_stock_threshold;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            {(() => {
                              const primaryImg =
                                p.images?.find((img) => img.is_primary) ||
                                p.images?.[0];
                              return primaryImg ? (
                                <img
                                  src={primaryImg.url}
                                  alt={p.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-zinc-200 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-300 text-xs shrink-0">
                                  📦
                                </div>
                              );
                            })()}
                            <div>
                              <p className="text-sm font-semibold text-zinc-800">
                                {p.name}
                              </p>
                              <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                {p.sku} {p.brand && `· ${p.brand}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-xs text-zinc-600">
                            {p.category?.name || (
                              <span className="italic text-zinc-400">
                                Chưa rõ
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <span className="text-sm font-semibold text-zinc-800">
                            {Number(p.selling_price).toLocaleString()}₫
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium ${isLowStock ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-700"}`}
                          >
                            {p.stock_quantity}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${p.status === "active" ? "text-emerald-700 bg-emerald-50" : "text-zinc-500 bg-zinc-100"}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${p.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`}
                            />
                            {p.status === "active" ? "Kinh doanh" : "Tạm dừng"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditClick(p)}
                              className="admin-btn-outline px-2.5 py-1 text-[10px]"
                            >
                              Sửa
                            </button>
                            {p.status === "active" ? (
                              <button
                                onClick={() => handleDeleteClick(p)}
                                className="admin-btn-outline px-2.5 py-1 text-[10px] hover:text-red-500 hover:border-red-200"
                              >
                                Dừng
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRestoreClick(p)}
                                className="admin-btn-outline px-2.5 py-1 text-[10px] text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              >
                                Bật
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {pagination.last_page > 1 && (
            <div className="shrink-0 px-5 py-3 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <span className="text-xs text-zinc-500">
                Trang {pagination.current_page} / {pagination.last_page}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.current_page === 1}
                  onClick={() => fetchProducts(pagination.current_page - 1)}
                  className="admin-btn-outline"
                >
                  Trước
                </button>
                <button
                  disabled={pagination.current_page === pagination.last_page}
                  onClick={() => fetchProducts(pagination.current_page + 1)}
                  className="admin-btn-outline"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BIỂU MẪU (PHẢI) */}
        <div className="lg:col-span-4 admin-card p-5 sticky top-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-800">
              {isEditing ? "Sửa thông tin hàng hóa" : "Thêm sản phẩm mới"}
            </h3>
            {isEditing && (
              <button
                onClick={resetForm}
                className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Hủy sửa
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="admin-form-label">
                Hình ảnh sản phẩm
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {productImages.map((img) => (
                  <div key={img.id} className="relative w-16 h-16 group">
                    <img
                      src={img.url}
                      alt={img.alt_text}
                      className={`w-16 h-16 object-cover rounded-lg border ${img.is_primary ? "border-emerald-500 ring-1 ring-emerald-400" : "border-zinc-200"}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleImageDelete(img)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Ảnh đang chờ (chưa có product_id, sẽ upload sau khi lưu) */}
                {pendingImagePreview && (
                  <div className="relative w-16 h-16 group">
                    <img
                      src={pendingImagePreview}
                      alt="Ảnh đang chờ"
                      className="w-16 h-16 object-cover rounded-lg border border-amber-400 ring-1 ring-amber-300"
                    />
                    <span className="absolute -bottom-1 left-0 right-0 text-center text-[8px] font-bold text-amber-600 bg-amber-50 rounded-b-lg">
                      Chờ lưu
                    </span>
                    <button
                      type="button"
                      onClick={handleRemovePendingImage}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {!pendingImagePreview && (
                  <button
                    type="button"
                    onClick={handleImageButtonClick}
                    disabled={isUploadingImage}
                    className="w-16 h-16 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 transition-colors text-xl"
                  >
                    {isUploadingImage ? (
                      <span className="w-4 h-4 border-2 border-zinc-300 border-t-emerald-600 rounded-full animate-spin" />
                    ) : (
                      "+"
                    )}
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
              <p className="text-[10px] text-zinc-400">
                {isEditing
                  ? "Ảnh có viền xanh là ảnh đại diện sản phẩm. JPG/PNG/WEBP, tối đa 2MB."
                  : "Chọn ảnh trước, ảnh sẽ tự động lưu khi bạn tạo sản phẩm. JPG/PNG/WEBP, tối đa 2MB."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-form-label">
                  Danh mục *
                </label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) =>
                    setForm({ ...form, category_id: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="" disabled>
                    Chọn danh mục
                  </option>
                  {categories.filter(c => c.status === "active").map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-form-label">
                  Mã SKU *
                </label>
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className={`${inputClass} font-mono`}
                  placeholder="VD: STING_LON"
                />
              </div>
            </div>

            <div>
              <label className="admin-form-label">
                Tên sản phẩm *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="VD: Nước tăng lực Sting"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-form-label">
                  Giá bán lẻ (₫) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.selling_price}
                  onChange={(e) =>
                    setForm({ ...form, selling_price: e.target.value })
                  }
                  className={inputClass}
                  placeholder="12000"
                />
              </div>
              <div>
                <label className="admin-form-label">
                  Mức báo yếu tồn kho
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.low_stock_threshold}
                  onChange={(e) =>
                    setForm({ ...form, low_stock_threshold: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="admin-form-label">
                Thương hiệu
              </label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className={inputClass}
                placeholder="VD: Pepsico"
              />
            </div>

            <div>
              <label className="admin-form-label">
                Ghi chú / Mô tả
              </label>
              <textarea
                rows="2"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={`${inputClass} resize-none`}
                placeholder="Mô tả thêm..."
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={
                  isProcessing ||
                  !form.name.trim() ||
                  !form.sku.trim() ||
                  form.selling_price === "" ||
                  !form.category_id
                }
                className={`w-full py-2.5 ${isEditing ? "admin-btn-secondary" : "admin-btn-primary"} ${isProcessing || !form.name.trim() || !form.sku.trim() || form.selling_price === "" || !form.category_id ? "opacity-60 cursor-not-allowed shadow-none hover:translate-y-0" : ""}`}
              >
                {isProcessing
                  ? "Đang lưu..."
                  : isEditing
                    ? "Lưu thay đổi"
                    : "Tạo sản phẩm"}
              </button>
            </div>
          </form>
        </div>
      </div>
        </>
      )}

      {activeTab === "categories" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* BẢNG DANH MỤC */}
          <div className="lg:col-span-8 admin-card overflow-hidden">
            <AnimatePresence>
              {catMessage.text && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`mx-5 mt-4 p-3 rounded-lg text-xs font-medium ${catMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}
                >
                  {catMessage.text}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Tên danh mục</th>
                    <th className="py-3 px-3">Mô tả</th>
                    <th className="py-3 px-3 text-center">Trạng thái</th>
                    <th className="py-3 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-16 text-center text-xs text-zinc-400">Chưa có danh mục nào</td>
                    </tr>
                  ) : (
                    categories.map((c) => (
                      <tr key={c.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group">
                        <td className="py-3.5 px-5 text-sm font-semibold text-zinc-800">{c.name}</td>
                        <td className="py-3.5 px-3">
                          <p className="text-xs text-zinc-500 truncate max-w-[280px]">
                            {c.description || <span className="text-zinc-300 italic">Không có mô tả</span>}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${c.status === "active" ? "text-emerald-700 bg-emerald-50" : "text-zinc-500 bg-zinc-100"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                            {c.status === "active" ? "Hoạt động" : "Tạm ẩn"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleCatEdit(c)} className="admin-btn-outline px-2.5 py-1 text-[10px]">Sửa</button>
                            {c.status === "active" && (
                              <button onClick={() => handleCatDelete(c)} className="admin-btn-outline px-2 py-1 text-[10px] hover:text-red-500 hover:border-red-200">Ẩn</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FORM DANH MỤC */}
          <div className="lg:col-span-4 admin-card p-5 sticky top-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-800">
                {isCatEditing ? "Sửa danh mục" : "Thêm danh mục mới"}
              </h3>
              {isCatEditing && (
                <button onClick={resetCatForm} className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">Hủy sửa</button>
              )}
            </div>
            <form onSubmit={handleCatSubmit} className="space-y-4">
              <div>
                <label className="admin-form-label">Tên danh mục *</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className={inputClass}
                  placeholder="Ví dụ: Nước giải khát"
                />
              </div>
              <div>
                <label className="admin-form-label">Mô tả chi tiết</label>
                <textarea
                  rows="3"
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  className={`${inputClass} resize-none`}
                  placeholder="Ghi chú thêm (không bắt buộc)..."
                />
              </div>
              <div>
                <label className="admin-form-label">Trạng thái</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCatForm({ ...catForm, status: "active" })}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors border ${catForm.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-400 border-transparent hover:bg-zinc-100"}`}>
                    Hoạt động
                  </button>
                  <button type="button" onClick={() => setCatForm({ ...catForm, status: "inactive" })}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors border ${catForm.status === "inactive" ? "bg-zinc-100 text-zinc-600 border-zinc-300" : "bg-zinc-50 text-zinc-400 border-transparent hover:bg-zinc-100"}`}>
                    Tạm ẩn
                  </button>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCatProcessing || !catForm.name.trim()}
                  className={`w-full py-2.5 ${isCatEditing ? "admin-btn-secondary" : "admin-btn-primary"} ${isCatProcessing || !catForm.name.trim() ? "opacity-60 cursor-not-allowed shadow-none hover:translate-y-0" : ""}`}
                >
                  {isCatProcessing ? "Đang lưu..." : isCatEditing ? "Lưu thay đổi" : "Tạo danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
