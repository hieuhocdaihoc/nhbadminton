<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        // Tắt strict mode để ALTER TABLE với TIMESTAMP NULL không bị warn->error
        DB::statement("SET SESSION sql_mode = ''");

        // =====================================================================
        // 1. users — Bảng tài khoản người dùng
        // =====================================================================
        DB::statement("ALTER TABLE users
            MODIFY id           CHAR(36)        NOT NULL COMMENT 'Mã định danh người dùng (UUID)',
            MODIFY full_name    VARCHAR(100)    NOT NULL COMMENT 'Họ và tên đầy đủ',
            MODIFY email        VARCHAR(150)    NOT NULL COMMENT 'Địa chỉ email dùng để đăng nhập',
            MODIFY phone        VARCHAR(20)     NULL     COMMENT 'Số điện thoại liên hệ',
            MODIFY password_hash VARCHAR(255)   NULL     COMMENT 'Mật khẩu đã mã hoá (bcrypt)',
            MODIFY role         ENUM('admin','staff','customer') NOT NULL DEFAULT 'customer' COMMENT 'Vai trò: admin / nhân viên / khách hàng',
            MODIFY gender       ENUM('male','female','other')    NULL     COMMENT 'Giới tính: nam / nữ / khác',
            MODIFY date_of_birth DATE           NULL     COMMENT 'Ngày sinh',
            MODIFY customer_code VARCHAR(20)    NULL     COMMENT 'Mã khách hàng hiển thị (VD: KH00001)',
            MODIFY membership_level VARCHAR(20) NOT NULL DEFAULT 'bronze' COMMENT 'Cấp độ thành viên: đồng / bạc / vàng / kim cương',
            MODIFY points       INT             NOT NULL DEFAULT 0 COMMENT 'Điểm tích luỹ hiện tại',
            MODIFY total_spent  DECIMAL(15,2)   NOT NULL DEFAULT 0 COMMENT 'Tổng số tiền khách đã chi tiêu',
            MODIFY status       ENUM('active','blocked') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái tài khoản: đang hoạt động / bị khóa',
            MODIFY created_at   TIMESTAMP       NULL COMMENT 'Thời điểm tạo tài khoản',
            MODIFY updated_at   TIMESTAMP       NULL COMMENT 'Thời điểm cập nhật gần nhất'
        ");

        // =====================================================================
        // 2. courts — Bảng sân cầu lông
        // =====================================================================
        DB::statement("ALTER TABLE courts
            MODIFY id             CHAR(36)     NOT NULL COMMENT 'Mã sân cầu lông (UUID)',
            MODIFY name           VARCHAR(100) NOT NULL COMMENT 'Tên sân (VD: Sân 01)',
            MODIFY court_code     VARCHAR(20)  NOT NULL COMMENT 'Mã sân viết tắt (VD: SAN01)',
            MODIFY floor_type     VARCHAR(50)  NULL     COMMENT 'Loại sàn sân: gỗ / nhựa PVC / bê tông...',
            MODIFY has_lighting   TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Sân có hệ thống đèn chiếu sáng không (1=có)',
            MODIFY capacity       INT          NULL     COMMENT 'Sức chứa tối đa (số người)',
            MODIFY location_note  VARCHAR(255) NULL     COMMENT 'Ghi chú vị trí trong khu nhà (VD: Tầng 2, khu A)',
            MODIFY is_maintenance TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Sân đang trong trạng thái bảo trì không (1=đang bảo trì)',
            MODIFY status         ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái sân: đang cho thuê / tạm ngừng'
        ");

        // =====================================================================
        // 3. images — Bảng ảnh đính kèm
        // =====================================================================
        DB::statement("ALTER TABLE images
            MODIFY id          CHAR(36)     NOT NULL COMMENT 'Mã ảnh (UUID)',
            MODIFY url         TEXT         NOT NULL COMMENT 'Đường dẫn URL của ảnh',
            MODIFY alt_text    VARCHAR(255) NULL     COMMENT 'Văn bản thay thế khi ảnh không hiển thị được',
            MODIFY target_type VARCHAR(50)  NULL     COMMENT 'Loại đối tượng ảnh gắn vào: court / product / service...',
            MODIFY target_id   CHAR(36)     NULL     COMMENT 'Mã của đối tượng ảnh gắn vào',
            MODIFY sort_order  INT          NOT NULL DEFAULT 0 COMMENT 'Thứ tự hiển thị ảnh (số nhỏ hiện trước)',
            MODIFY is_primary  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Đây có phải ảnh đại diện chính không (1=có)'
        ");

        // =====================================================================
        // 4. additional_services — Bảng dịch vụ bổ sung
        // =====================================================================
        DB::statement("ALTER TABLE additional_services
            MODIFY id           CHAR(36)     NOT NULL COMMENT 'Mã dịch vụ bổ sung (UUID)',
            MODIFY name         VARCHAR(100) NOT NULL COMMENT 'Tên dịch vụ (VD: Thuê vợt, Mua nước...)',
            MODIFY service_type VARCHAR(50)  NULL     COMMENT 'Loại dịch vụ để nhóm hiển thị',
            MODIFY description  TEXT         NULL     COMMENT 'Mô tả chi tiết dịch vụ',
            MODIFY price        DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Giá dịch vụ (VNĐ)',
            MODIFY unit         VARCHAR(30)  NULL     COMMENT 'Đơn vị tính: lần / giờ / cái...',
            MODIFY status       ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái: đang bán / ngừng bán'
        ");

        // =====================================================================
        // 5. categories — Bảng danh mục sản phẩm
        // =====================================================================
        DB::statement("ALTER TABLE categories
            MODIFY id          CHAR(36)     NOT NULL COMMENT 'Mã danh mục sản phẩm (UUID)',
            MODIFY name        VARCHAR(100) NOT NULL COMMENT 'Tên danh mục (VD: Vợt cầu lông, Giày...)',
            MODIFY description TEXT         NULL     COMMENT 'Mô tả danh mục',
            MODIFY status      ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái danh mục: hiển thị / ẩn'
        ");

        // =====================================================================
        // 6. suppliers — Bảng nhà cung cấp
        // =====================================================================
        DB::statement("ALTER TABLE suppliers
            MODIFY id             CHAR(36)     NOT NULL COMMENT 'Mã nhà cung cấp (UUID)',
            MODIFY name           VARCHAR(150) NOT NULL COMMENT 'Tên công ty / cá nhân cung cấp hàng',
            MODIFY phone          VARCHAR(20)  NULL     COMMENT 'Số điện thoại liên hệ nhà cung cấp',
            MODIFY email          VARCHAR(150) NULL     COMMENT 'Email liên hệ nhà cung cấp',
            MODIFY address        VARCHAR(255) NULL     COMMENT 'Địa chỉ nhà cung cấp',
            MODIFY contact_person VARCHAR(100) NULL     COMMENT 'Tên người phụ trách liên hệ tại nhà cung cấp'
        ");

        // =====================================================================
        // 7. products — Bảng sản phẩm
        // =====================================================================
        DB::statement("ALTER TABLE products
            MODIFY id                  CHAR(36)     NOT NULL COMMENT 'Mã sản phẩm (UUID)',
            MODIFY category_id         CHAR(36)     NULL COMMENT 'Mã danh mục sản phẩm thuộc về',
            MODIFY brand               VARCHAR(100) NULL COMMENT 'Thương hiệu sản phẩm (VD: Yonex, Victor...)',
            MODIFY name                VARCHAR(150) NOT NULL COMMENT 'Tên sản phẩm',
            MODIFY sku                 VARCHAR(50)  NULL COMMENT 'Mã SKU quản lý kho nội bộ',
            MODIFY description         TEXT         NULL COMMENT 'Mô tả đầy đủ sản phẩm',
            MODIFY short_description   TEXT         NULL COMMENT 'Mô tả ngắn hiển thị trên danh sách',
            MODIFY material            VARCHAR(100) NULL COMMENT 'Chất liệu sản phẩm',
            MODIFY origin              VARCHAR(100) NULL COMMENT 'Xuất xứ / nước sản xuất',
            MODIFY sold_count          INT          NOT NULL DEFAULT 0 COMMENT 'Tổng số lượng đã bán ra',
            MODIFY stock_quantity      INT          NOT NULL DEFAULT 0 COMMENT 'Số lượng tồn kho hiện tại',
            MODIFY low_stock_threshold INT          NOT NULL DEFAULT 5 COMMENT 'Ngưỡng cảnh báo sắp hết hàng (hiện cảnh báo khi tồn kho ≤ giá trị này)',
            MODIFY status              ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái sản phẩm: đang bán / ngừng bán',
            MODIFY selling_price       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Giá bán lẻ (VNĐ)',
            MODIFY created_at          TIMESTAMP NULL COMMENT 'Thời điểm thêm sản phẩm vào hệ thống',
            MODIFY updated_at          TIMESTAMP NULL COMMENT 'Thời điểm cập nhật thông tin gần nhất'
        ");

        // =====================================================================
        // 8. promotions — Bảng mã giảm giá / khuyến mãi
        // =====================================================================
        DB::statement("ALTER TABLE promotions
            MODIFY id                 CHAR(36)     NOT NULL COMMENT 'Mã khuyến mãi (UUID)',
            MODIFY code               VARCHAR(50)  NOT NULL COMMENT 'Mã voucher khách nhập vào khi đặt sân (VD: GIAM10K)',
            MODIFY name               VARCHAR(150) NOT NULL COMMENT 'Tên chương trình khuyến mãi',
            MODIFY discount_type      ENUM('percent','fixed') NOT NULL DEFAULT 'percent' COMMENT 'Loại giảm: percent = theo % tổng đơn, fixed = số tiền cố định',
            MODIFY discount_value     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Giá trị giảm: nếu là % thì nhập số phần trăm, nếu là fixed thì nhập số VNĐ',
            MODIFY per_user_limit     INT          NULL COMMENT 'Số lần tối đa mỗi khách được dùng mã này (NULL = không giới hạn)',
            MODIFY min_points_required INT         NOT NULL DEFAULT 0 COMMENT 'Điểm tích luỹ tối thiểu khách cần có để dùng mã',
            MODIFY valid_from         DATE         NULL COMMENT 'Ngày bắt đầu mã có hiệu lực',
            MODIFY valid_to           DATE         NULL COMMENT 'Ngày kết thúc hiệu lực của mã',
            MODIFY auto_apply         TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Tự động áp mã khi đặt sân mà không cần khách nhập (1=tự động)',
            MODIFY description        VARCHAR(255) NULL COMMENT 'Mô tả điều kiện và ưu đãi của mã',
            MODIFY status             ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái mã: đang hoạt động / đã tắt'
        ");

        // =====================================================================
        // 9. system_settings — Bảng cài đặt hệ thống
        // =====================================================================
        DB::statement("ALTER TABLE system_settings
            MODIFY id            CHAR(36)  NOT NULL COMMENT 'Mã cài đặt (UUID)',
            MODIFY setting_key   VARCHAR(100) NOT NULL COMMENT 'Tên khoá cấu hình (VD: deposit_amount, booking_policy...)',
            MODIFY setting_value TEXT      NULL COMMENT 'Giá trị cấu hình tương ứng với khoá'
        ");

        // =====================================================================
        // 10. recurring_bookings — Bảng hợp đồng đặt sân định kỳ / dài hạn
        // =====================================================================
        DB::statement("ALTER TABLE recurring_bookings
            MODIFY id             CHAR(36)     NOT NULL COMMENT 'Mã hợp đồng định kỳ / dài hạn (UUID)',
            MODIFY user_id        CHAR(36)     NULL     COMMENT 'Mã tài khoản khách hàng ký hợp đồng',
            MODIFY court_id       CHAR(36)     NULL     COMMENT 'Mã sân đăng ký trong hợp đồng',
            MODIFY recurring_code VARCHAR(30)  NOT NULL COMMENT 'Mã hợp đồng hiển thị cho khách (VD: REC_ABC12)',
            MODIFY days_of_week   JSON         NULL     COMMENT 'Danh sách ngày trong tuần lịch chơi: [2,4,6] = Thứ 2, Thứ 4, Thứ 6',
            MODIFY start_time     TIME         NOT NULL COMMENT 'Giờ bắt đầu buổi chơi trong hợp đồng',
            MODIFY end_time       TIME         NOT NULL COMMENT 'Giờ kết thúc buổi chơi trong hợp đồng',
            MODIFY start_date     DATE         NOT NULL COMMENT 'Ngày bắt đầu hiệu lực hợp đồng',
            MODIFY end_date       DATE         NULL     COMMENT 'Ngày kết thúc hợp đồng (NULL = chưa xác định)',
            MODIFY status         ENUM('active','inactive','cancelled') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái hợp đồng: đang chạy / tạm ngừng / đã huỷ',
            MODIFY type           ENUM('recurring','long_term') NOT NULL DEFAULT 'recurring' COMMENT 'Loại hợp đồng: recurring = định kỳ hàng tuần, long_term = dài hạn'
        ");

        // =====================================================================
        // 11. bookings — Bảng đơn đặt sân
        // =====================================================================
        DB::statement("ALTER TABLE bookings
            MODIFY id                   CHAR(36)     NOT NULL COMMENT 'Mã đơn đặt sân (UUID)',
            MODIFY booking_code         VARCHAR(30)  NOT NULL COMMENT 'Mã đơn hiển thị cho khách tra cứu (VD: BILL_ABCDE)',
            MODIFY user_id              CHAR(36)     NULL     COMMENT 'Mã tài khoản khách hàng (NULL nếu khách đặt không có tài khoản)',
            MODIFY recurring_booking_id CHAR(36)     NULL     COMMENT 'Mã hợp đồng định kỳ nếu đơn này phát sinh từ hợp đồng đó',
            MODIFY staff_id             CHAR(36)     NULL     COMMENT 'Mã nhân viên tạo đơn tại quầy (NULL nếu khách tự đặt online)',
            MODIFY promotion_id         CHAR(36)     NULL     COMMENT 'Mã khuyến mãi được áp dụng cho đơn này',
            MODIFY subtotal_court       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tổng tiền sân (chưa tính dịch vụ và chưa giảm giá)',
            MODIFY subtotal_service     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tổng tiền dịch vụ và sản phẩm bổ sung thêm vào đơn',
            MODIFY discount_amount      DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Số tiền được giảm từ khuyến mãi',
            MODIFY total_price          DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tổng tiền phải trả sau khi giảm giá (= tiền sân + dịch vụ - giảm giá)',
            MODIFY deposit_amount       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tổng số tiền khách đã thanh toán tính đến hiện tại (cọc + các lần thu thêm)',
            MODIFY remaining_amount     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Số tiền còn lại khách chưa thanh toán (= tổng - đã thu)',
            MODIFY customer_name        VARCHAR(100) NULL     COMMENT 'Tên khách điền khi đặt không có tài khoản',
            MODIFY customer_phone       VARCHAR(20)  NULL     COMMENT 'Số điện thoại khách điền khi đặt không có tài khoản',
            MODIFY check_in_at          DATETIME     NULL     COMMENT 'Thời điểm khách check-in vào sân (nhân viên bấm)',
            MODIFY check_out_at         DATETIME     NULL     COMMENT 'Thời điểm khách check-out ra về (nhân viên bấm)',
            MODIFY status               ENUM('confirmed','completed','cancelled','playing') NOT NULL DEFAULT 'confirmed' COMMENT 'Trạng thái đơn: đã chốt / đang chơi / hoàn thành / đã huỷ',
            MODIFY payment_status       ENUM('unpaid','partially_paid','paid') NOT NULL DEFAULT 'unpaid' COMMENT 'Trạng thái thanh toán: chưa thu / thu một phần / đã thu đủ',
            MODIFY points_awarded_at    DATETIME     NULL     COMMENT 'Thời điểm hệ thống đã cộng điểm thưởng cho đơn này (NULL = chưa cộng)'
        ");

        // =====================================================================
        // 12. booking_details — Bảng chi tiết ca chơi trong đơn
        // =====================================================================
        DB::statement("ALTER TABLE booking_details
            MODIFY id               CHAR(36)     NOT NULL COMMENT 'Mã chi tiết ca chơi (UUID)',
            MODIFY booking_id       CHAR(36)     NULL     COMMENT 'Mã đơn đặt sân chứa ca chơi này',
            MODIFY court_id         CHAR(36)     NULL     COMMENT 'Mã sân của ca chơi',
            MODIFY booking_date     DATE         NOT NULL COMMENT 'Ngày diễn ra ca chơi',
            MODIFY start_time       TIME         NOT NULL COMMENT 'Giờ bắt đầu ca chơi',
            MODIFY end_time         TIME         NOT NULL COMMENT 'Giờ kết thúc ca chơi',
            MODIFY duration_minutes INT          NOT NULL DEFAULT 0 COMMENT 'Tổng số phút chơi theo lịch đặt',
            MODIFY price_per_hour   DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Giá thuê sân mỗi giờ tại thời điểm đặt (theo bảng giá)',
            MODIFY price            DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tổng tiền ca chơi này (= giá/giờ × số giờ)',
            MODIFY overtime_minutes INT          NOT NULL DEFAULT 0 COMMENT 'Số phút khách chơi thêm ngoài giờ đặt ban đầu',
            MODIFY overtime_fee     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Phí phát sinh do chơi quá giờ đặt'
        ");

        // =====================================================================
        // 13. booking_service_details — Bảng dịch vụ / sản phẩm thêm vào đơn
        // =====================================================================
        DB::statement("ALTER TABLE booking_service_details
            MODIFY id          CHAR(36)     NOT NULL COMMENT 'Mã dòng dịch vụ / sản phẩm trong đơn (UUID)',
            MODIFY booking_id  CHAR(36)     NULL     COMMENT 'Mã đơn đặt sân',
            MODIFY service_id  CHAR(36)     NULL     COMMENT 'Mã dịch vụ bổ sung (NULL nếu đây là sản phẩm)',
            MODIFY product_id  CHAR(36)     NULL     COMMENT 'Mã sản phẩm (NULL nếu đây là dịch vụ)',
            MODIFY quantity    INT          NOT NULL DEFAULT 1 COMMENT 'Số lượng mua',
            MODIFY unit_price  DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Đơn giá tại thời điểm thêm vào đơn',
            MODIFY total_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Thành tiền dòng này (= đơn giá × số lượng)',
            MODIFY note        VARCHAR(255) NULL     COMMENT 'Ghi chú thêm cho dòng dịch vụ / sản phẩm'
        ");

        // =====================================================================
        // 14. booking_intents — Bảng phiên đặt sân online đang chờ thanh toán
        // =====================================================================
        DB::statement("ALTER TABLE booking_intents
            MODIFY id           CHAR(36)     NOT NULL COMMENT 'Mã phiên đặt sân (UUID)',
            MODIFY intent_code  VARCHAR(20)  NOT NULL COMMENT 'Mã phiên hiển thị trong nội dung chuyển khoản (VD: NH12345)',
            MODIFY payload      JSON         NOT NULL COMMENT 'Toàn bộ dữ liệu đặt sân đang chờ xác nhận lưu dạng JSON',
            MODIFY amount       DECIMAL(12,2) NOT NULL COMMENT 'Số tiền khách cần chuyển khoản để xác nhận đơn',
            MODIFY booking_type VARCHAR(20)  NOT NULL COMMENT 'Loại đặt: single = đơn lẻ, recurring = định kỳ, long_term = dài hạn',
            MODIFY expires_at   TIMESTAMP    NOT NULL COMMENT 'Thời điểm phiên hết hạn — quá giờ này hệ thống tự huỷ',
            MODIFY created_at   TIMESTAMP    NULL COMMENT 'Thời điểm tạo phiên',
            MODIFY updated_at   TIMESTAMP    NULL COMMENT 'Thời điểm cập nhật gần nhất'
        ");

        // =====================================================================
        // 15. payments — Bảng giao dịch thanh toán
        // =====================================================================
        DB::statement("ALTER TABLE payments
            MODIFY id                    CHAR(36)     NOT NULL COMMENT 'Mã giao dịch thanh toán (UUID)',
            MODIFY payment_code          VARCHAR(50)  NULL     COMMENT 'Mã giao dịch hiển thị (VD: PAY_ABCDE)',
            MODIFY booking_id            CHAR(36)     NULL     COMMENT 'Mã đơn đặt sân được thanh toán trong giao dịch này',
            MODIFY user_id               CHAR(36)     NULL     COMMENT 'Mã tài khoản người thực hiện thanh toán',
            MODIFY payment_method        VARCHAR(50)  NULL     COMMENT 'Phương thức: cash = tiền mặt / bank_transfer = chuyển khoản / sepay = online',
            MODIFY amount                DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Số tiền của giao dịch này (VNĐ)',
            MODIFY paid_at               DATETIME     NULL     COMMENT 'Thời điểm thanh toán thực tế được xác nhận',
            MODIFY status                ENUM('pending','success','completed','failed','refunded') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái: pending=chờ / success=thành công / failed=thất bại / refunded=đã hoàn tiền',
            MODIFY sepay_transaction_id  VARCHAR(100) NULL     COMMENT 'Mã giao dịch từ cổng SePay (thanh toán online)',
            MODIFY bank_gateway          VARCHAR(50)  NULL     COMMENT 'Tên ngân hàng hoặc cổng thanh toán sử dụng',
            MODIFY reference_code        VARCHAR(100) NULL     COMMENT 'Mã tham chiếu từ phía ngân hàng',
            MODIFY payment_content       VARCHAR(255) NULL     COMMENT 'Nội dung chuyển khoản ghi trong tin nhắn ngân hàng'
        ");

        // =====================================================================
        // 16. refunds — Bảng phiếu hoàn tiền
        // =====================================================================
        DB::statement("ALTER TABLE refunds
            MODIFY id            CHAR(36)     NOT NULL COMMENT 'Mã phiếu hoàn tiền (UUID)',
            MODIFY payment_id    CHAR(36)     NULL     COMMENT 'Mã giao dịch thanh toán gốc cần được hoàn',
            MODIFY amount        DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Số tiền hoàn lại cho khách (VNĐ)',
            MODIFY reason        TEXT         NULL     COMMENT 'Lý do hoàn tiền (huỷ đơn / sai giá / lỗi hệ thống...)',
            MODIFY refund_method VARCHAR(30)  NOT NULL DEFAULT 'cash' COMMENT 'Hình thức hoàn: cash = tiền mặt / bank_transfer = chuyển khoản',
            MODIFY refund_info   VARCHAR(255) NULL     COMMENT 'Thông tin tài khoản ngân hàng nhận tiền hoàn (nếu chuyển khoản)',
            MODIFY processed_by  CHAR(36)     NULL     COMMENT 'Mã nhân viên / admin thực hiện hoàn tiền',
            MODIFY status        ENUM('recorded','pending','completed','rejected') NOT NULL DEFAULT 'recorded' COMMENT 'Trạng thái: recorded=đã ghi nhận / completed=đã hoàn xong / rejected=từ chối',
            MODIFY created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm ghi nhận phiếu hoàn tiền'
        ");

        // =====================================================================
        // 17. reviews — Bảng đánh giá
        // =====================================================================
        DB::statement("ALTER TABLE reviews
            MODIFY id          CHAR(36)     NOT NULL COMMENT 'Mã đánh giá (UUID)',
            MODIFY user_id     CHAR(36)     NULL     COMMENT 'Mã tài khoản người viết đánh giá',
            MODIFY target_type VARCHAR(50)  NULL     COMMENT 'Loại đối tượng được đánh giá: court = sân / service = dịch vụ...',
            MODIFY target_id   CHAR(36)     NULL     COMMENT 'Mã của đối tượng được đánh giá',
            MODIFY booking_id  CHAR(36)     NULL     COMMENT 'Mã đơn đặt sân gắn với đánh giá này (mỗi đơn chỉ được đánh giá 1 lần)',
            MODIFY rating      TINYINT      NOT NULL DEFAULT 5 COMMENT 'Điểm đánh giá từ 1 đến 5 sao',
            MODIFY comment     TEXT         NULL     COMMENT 'Nội dung bình luận của khách hàng',
            MODIFY staff_reply TEXT         NULL     COMMENT 'Phản hồi của nhân viên hoặc quản lý cho đánh giá này',
            MODIFY status      VARCHAR(50)  NOT NULL DEFAULT 'approved' COMMENT 'Trạng thái: approved = đã duyệt hiển thị / hidden = đang ẩn'
        ");

        // =====================================================================
        // 18. notifications — Bảng thông báo
        // =====================================================================
        DB::statement("ALTER TABLE notifications
            MODIFY id          CHAR(36)     NOT NULL COMMENT 'Mã thông báo (UUID)',
            MODIFY receiver_id CHAR(36)     NULL     COMMENT 'Mã người nhận thông báo',
            MODIFY sender_id   CHAR(36)     NULL     COMMENT 'Mã người hoặc hệ thống gửi thông báo (NULL = hệ thống tự gửi)',
            MODIFY title       VARCHAR(255) NULL     COMMENT 'Tiêu đề thông báo',
            MODIFY content     TEXT         NULL     COMMENT 'Nội dung chi tiết thông báo',
            MODIFY is_read     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Người nhận đã đọc thông báo này chưa (0=chưa đọc, 1=đã đọc)',
            MODIFY created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm gửi thông báo',
            MODIFY group_key   VARCHAR(64)  NULL     COMMENT 'Khoá nhóm để gộp nhiều thông báo liên quan lại với nhau'
        ");

        // =====================================================================
        // 19. court_pricing — Bảng khung giá sân
        // =====================================================================
        DB::statement("ALTER TABLE court_pricing
            MODIFY id                  CHAR(36)     NOT NULL COMMENT 'Mã khung giá (UUID)',
            MODIFY day_type            VARCHAR(30)  NULL     COMMENT 'Loại ngày áp dụng: weekday = thường / weekend = cuối tuần / holiday = ngày lễ',
            MODIFY start_time          TIME         NOT NULL COMMENT 'Giờ bắt đầu khung giờ áp dụng',
            MODIFY end_time            TIME         NOT NULL COMMENT 'Giờ kết thúc khung giờ áp dụng',
            MODIFY price               DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Giá thuê sân mỗi giờ trong khung này (VNĐ/giờ)',
            MODIFY effective_from      DATE         NULL     COMMENT 'Ngày bắt đầu áp dụng bảng giá này',
            MODIFY effective_to        DATE         NULL     COMMENT 'Ngày kết thúc áp dụng (NULL = áp dụng mãi mãi)',
            MODIFY min_booking_minutes INT          NOT NULL DEFAULT 60 COMMENT 'Số phút tối thiểu phải đặt trong khung giờ này'
        ");

        // =====================================================================
        // 20. court_price_histories — Bảng lịch sử thay đổi giá sân
        // =====================================================================
        DB::statement("ALTER TABLE court_price_histories
            MODIFY id               CHAR(36)     NOT NULL COMMENT 'Mã bản ghi lịch sử (UUID)',
            MODIFY court_pricing_id CHAR(36)     NULL     COMMENT 'Mã khung giá bị thay đổi',
            MODIFY old_price        DECIMAL(12,2) NULL    COMMENT 'Giá cũ trước khi thay đổi (VNĐ/giờ)',
            MODIFY new_price        DECIMAL(12,2) NULL    COMMENT 'Giá mới sau khi thay đổi (VNĐ/giờ)',
            MODIFY action           VARCHAR(20)  NOT NULL DEFAULT 'update' COMMENT 'Hành động: update = cập nhật / create = tạo mới / delete = xoá bảng giá',
            MODIFY note             VARCHAR(255) NULL     COMMENT 'Ghi chú lý do thay đổi giá',
            MODIFY changed_by       CHAR(36)     NULL     COMMENT 'Mã nhân viên / admin thực hiện thay đổi',
            MODIFY created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm thực hiện thay đổi'
        ");

        // =====================================================================
        // 21. Staff_Shifts — Bảng ca làm việc nhân viên
        // =====================================================================
        DB::statement("ALTER TABLE Staff_Shifts
            MODIFY id             CHAR(36)     NOT NULL COMMENT 'Mã ca làm việc (UUID)',
            MODIFY staff_id       CHAR(36)     NULL     COMMENT 'Mã nhân viên được phân ca này',
            MODIFY shift_date     DATE         NOT NULL COMMENT 'Ngày làm việc của ca',
            MODIFY shift_name     VARCHAR(50)  NULL     COMMENT 'Tên ca làm: Sáng / Chiều / Tối',
            MODIFY start_time     TIME         NOT NULL COMMENT 'Giờ bắt đầu ca theo lịch phân công',
            MODIFY end_time       TIME         NOT NULL COMMENT 'Giờ kết thúc ca theo lịch phân công',
            MODIFY check_in_time  DATETIME     NULL     COMMENT 'Thời điểm nhân viên thực tế check-in vào làm',
            MODIFY check_out_time DATETIME     NULL     COMMENT 'Thời điểm nhân viên thực tế check-out kết thúc ca',
            MODIFY status         VARCHAR(30)  NOT NULL DEFAULT 'scheduled' COMMENT 'Trạng thái ca: scheduled=chờ / completed=hoàn thành / absent=vắng',
            MODIFY note           TEXT         NULL     COMMENT 'Ghi chú ca làm (lý do vắng, đi muộn, tăng ca...)'
        ");

        // =====================================================================
        // 22. inventory_transactions — Bảng lịch sử xuất nhập kho
        // =====================================================================
        DB::statement("ALTER TABLE inventory_transactions
            MODIFY id               CHAR(36)     NOT NULL COMMENT 'Mã giao dịch kho (UUID)',
            MODIFY product_id       CHAR(36)     NULL     COMMENT 'Mã sản phẩm liên quan đến giao dịch',
            MODIFY transaction_type VARCHAR(30)  NOT NULL COMMENT 'Loại giao dịch: import=nhập kho / export=xuất bán / adjust=điều chỉnh thủ công',
            MODIFY quantity         INT          NOT NULL DEFAULT 0 COMMENT 'Số lượng thay đổi trong giao dịch này (luôn dương)',
            MODIFY before_quantity  INT          NOT NULL DEFAULT 0 COMMENT 'Tồn kho trước khi thực hiện giao dịch',
            MODIFY after_quantity   INT          NOT NULL DEFAULT 0 COMMENT 'Tồn kho sau khi thực hiện giao dịch',
            MODIFY reference_type   VARCHAR(50)  NULL     COMMENT 'Loại chứng từ tham chiếu: purchase_order / booking / manual...',
            MODIFY reference_id     CHAR(36)     NULL     COMMENT 'Mã chứng từ tham chiếu (mã phiếu nhập hoặc mã đơn đặt sân)',
            MODIFY note             TEXT         NULL     COMMENT 'Ghi chú lý do hoặc mô tả thêm cho giao dịch kho',
            MODIFY created_by       CHAR(36)     NULL     COMMENT 'Mã người thực hiện giao dịch kho',
            MODIFY created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm thực hiện giao dịch kho'
        ");

        // =====================================================================
        // 23. purchase_orders — Bảng phiếu nhập hàng
        // =====================================================================
        DB::statement("ALTER TABLE purchase_orders
            MODIFY id            CHAR(36)     NOT NULL COMMENT 'Mã phiếu nhập hàng (UUID)',
            MODIFY supplier_id   CHAR(36)     NULL     COMMENT 'Mã nhà cung cấp của lô hàng này',
            MODIFY purchase_code VARCHAR(30)  NOT NULL COMMENT 'Mã phiếu nhập hiển thị (VD: PO_20260714)',
            MODIFY total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Tổng giá trị toàn bộ phiếu nhập (VNĐ)',
            MODIFY status        ENUM('completed') NOT NULL DEFAULT 'completed' COMMENT 'Trạng thái phiếu nhập (luôn là completed sau khi nhập kho)',
            MODIFY created_by    CHAR(36)     NULL     COMMENT 'Mã nhân viên tạo phiếu nhập',
            MODIFY created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo phiếu nhập'
        ");

        // =====================================================================
        // 24. purchase_order_details — Bảng chi tiết từng dòng trong phiếu nhập
        // =====================================================================
        DB::statement("ALTER TABLE purchase_order_details
            MODIFY id                CHAR(36)     NOT NULL COMMENT 'Mã dòng chi tiết phiếu nhập (UUID)',
            MODIFY purchase_order_id CHAR(36)     NULL     COMMENT 'Mã phiếu nhập hàng chứa dòng này',
            MODIFY product_id        CHAR(36)     NULL     COMMENT 'Mã sản phẩm được nhập',
            MODIFY quantity          INT          NOT NULL DEFAULT 1 COMMENT 'Số lượng nhập trong dòng này',
            MODIFY import_price      DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Giá nhập mỗi đơn vị (VNĐ)',
            MODIFY total_price       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Thành tiền dòng này (= giá nhập × số lượng)'
        ");
    }

    public function down(): void
    {
        // Không cần rollback comment — chỉ là metadata, không ảnh hưởng dữ liệu
    }
};
