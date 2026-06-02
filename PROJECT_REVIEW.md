# NH Badminton - Báo Cáo Rà Soát Project

Ngày rà soát: `01/06/2026`

Mục tiêu: đánh giá project theo tiêu chí khóa luận gồm nghiệp vụ thực tế, bảo mật, tính nhất quán dữ liệu, khả năng bảo trì và mức độ sẵn sàng demo.

---

## 1. Tóm Tắt Nhanh

Project đã có đủ các module chính để trình bày một hệ thống quản lý sân cầu lông:

| Nhóm chức năng                     | Trạng thái | Nhận xét                                           |
| ---------------------------------- | ---------: | -------------------------------------------------- |
| Đặt sân lẻ / định kỳ               |         Có | Cần siết chống trùng lịch trong transaction        |
| Quản lý sân / giá sân              |         Có | Nghiệp vụ cơ bản ổn                                |
| Thanh toán tiền mặt / chuyển khoản |         Có | Webhook cần xác thực, luồng payment cần thống nhất |
| Điểm thành viên                    |         Có | Đang cộng sai thời điểm nghiệp vụ                  |
| Voucher                            |         Có | Cần kiểm soát lượt dùng chặt hơn nếu mở rộng       |
| Kho / sản phẩm / dịch vụ           |         Có | Cần kiểm tra quyền staff và đối soát kho           |
| Phân quyền admin/staff/customer    |         Có | Role đã có, permission còn thô                     |
| Thông báo admin/staff              |         Có | Cơ chế polling chấp nhận được cho khóa luận        |
| Đánh giá sân                       |         Có | Cần thêm trạng thái kiểm duyệt                     |

Kết luận ngắn: project có nền tốt, nhưng trước khi bảo vệ nên ưu tiên sửa các vấn đề P0/P1 vì đây là nhóm dễ bị hỏi khi chấm nghiệp vụ và bảo mật.

---

## 2. Bảng Ưu Tiên Xử Lý

| Mã  | Mức | Hạng mục                            | Tác động                           | Trạng thái          |
| --- | --- | ----------------------------------- | ---------------------------------- | ------------------- |
| R01 | P0  | Xác thực webhook SePay              | Bảo mật thanh toán                 | Chưa sửa            |
| R02 | P0  | Cộng điểm sai thời điểm             | Sai nghiệp vụ thành viên           | Đã sửa logic cơ bản |
| R03 | P0  | State machine đơn đặt sân           | Sai vòng đời đơn                   | Chưa sửa            |
| R04 | P1  | Race condition khi đặt sân          | Có thể double booking              | Đã sửa logic cơ bản |
| R05 | P1  | Cash/webhook không dùng chung logic | Dữ liệu thanh toán không nhất quán | Đã sửa logic cơ bản |
| R06 | P1  | Review chưa có kiểm duyệt           | Nội dung xấu có thể public         | Đã sửa logic cơ bản |
| R07 | P1  | Login chưa rate limit               | Dễ brute force                     | Chưa sửa            |
| R08 | P1  | Staff có quyền rộng                 | Rủi ro phân quyền                  | Chưa sửa            |
| R09 | P1  | Update địa chỉ dùng request all     | Pattern bảo mật chưa tốt           | Chưa sửa            |
| R10 | P2  | Encoding tiếng Việt lỗi             | Giảm tính chuyên nghiệp            | Chưa sửa            |
| R11 | P2  | Controller chứa quá nhiều nghiệp vụ | Khó test, khó bảo trì              | Chưa sửa            |
| R12 | P2  | Thiếu test nghiệp vụ                | Khó chứng minh độ đúng             | Chưa sửa            |

Quy ước mức độ:

- `P0`: Nên sửa trước khi demo/bảo vệ.
- `P1`: Rủi ro cao, nên sửa sớm.
- `P2`: Cải thiện chất lượng và tính chuyên nghiệp.

---

## 3. Checklist Hành Động

### Giai đoạn 1 - Bắt buộc trước demo

- [ ] Thêm xác thực webhook SePay.
- [ ] Thiết kế state machine cho đơn đặt sân.
- [x] Chuyển logic cộng điểm sang lúc đơn `completed + paid`.
- [x] Thêm cơ chế chống cộng điểm trùng bằng `bookings.points_awarded_at`.

### Giai đoạn 2 - Làm đúng nghiệp vụ thực tế

- [x] Đưa kiểm tra trùng lịch vào trong transaction.
- [x] Đồng bộ logic payment giữa tiền mặt và webhook.
- [x] Thêm `status` cho review: `pending`, `approved`, `hidden`.
- [ ] Tách quyền staff chi tiết hơn.

### Giai đoạn 3 - Làm sạch code để bảo vệ

- [ ] Sửa toàn bộ lỗi encoding tiếng Việt.
- [ ] Tách service nghiệp vụ chính.
- [ ] Viết test cho booking, payment, point, review.
- [ ] Chuẩn hóa response API và message lỗi.

---

## 4. Chi Tiết Rủi Ro Và Hướng Sửa

### R01 - Webhook SePay chưa xác thực nguồn gửi

**Mức độ:** P0

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/Payment/SePayController.php`
- Hàm `webhook`

**Vấn đề:**

Endpoint webhook đang public. Hệ thống nhận dữ liệu request, tìm mã `BILL_...`, đọc `transferAmount`, sau đó cập nhật thanh toán. Chưa thấy kiểm tra secret token, chữ ký webhook, header xác thực hoặc IP allowlist.

**Rủi ro:**

Người ngoài có thể giả lập request webhook để đánh dấu đơn đã thanh toán. Đây là rủi ro nghiêm trọng vì tác động trực tiếp đến tiền và trạng thái đơn.

**Hướng sửa đề xuất:**

1. Thêm biến môi trường:

```env
SEPAY_WEBHOOK_SECRET=your-secret
```

2. Webhook phải kiểm tra header:

```php
if ($request->header('X-Webhook-Secret') !== config('services.sepay.webhook_secret')) {
    return response()->json(['message' => 'Unauthorized'], 401);
}
```

3. Kiểm tra:

- `transferAmount > 0`
- `transferType = in`
- `sepay_transaction_id` hoặc `referenceCode` chưa tồn tại
- Không trả debug transaction ra public response

---

### R02 - Cộng điểm thành viên sai thời điểm nghiệp vụ

**Mức độ:** P0

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/Admin/BookingController.php`
- Hàm `updatePayment`
- Hàm `rewardCustomerForCompletedBooking`

**Vấn đề:**

Điểm đang được cộng khi `payment_status` chuyển sang `paid`. Tuy nhiên nghiệp vụ đã định nghĩa là khách chơi xong/đơn hoàn thành thì mới cộng điểm.

**Rủi ro:**

- Khách thanh toán trước nhưng chưa chơi vẫn được cộng điểm.
- Khách có thể dùng điểm/voucher trước khi dịch vụ thực sự hoàn tất.
- Khó giải thích trong bảo vệ khóa luận.

**Hướng sửa đề xuất:**

Chỉ cộng điểm khi:

- `booking.status = completed`
- `booking.payment_status = paid`
- Đơn chưa từng được cộng điểm

Nên thêm một trong hai hướng:

**Phương án tối thiểu:**

```sql
ALTER TABLE bookings ADD points_awarded_at datetime NULL;
```

**Phương án tốt hơn cho khóa luận:**

```sql
CREATE TABLE point_transactions (
  id char(36) primary key,
  user_id char(36),
  booking_id char(36),
  points int,
  type varchar(50),
  note text,
  created_at timestamp default current_timestamp
);
```

---

### R03 - Đơn đặt sân chưa có state machine

**Mức độ:** P0

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/Admin/BookingController.php`
- Hàm `updateStatus`

**Vấn đề:**

API cho cập nhật trực tiếp sang `pending`, `confirmed`, `cancelled`, `completed` mà không kiểm tra trạng thái trước đó.

**Rủi ro:**

Các luồng sai có thể xảy ra:

- `cancelled -> completed`
- `completed -> pending`
- `pending -> completed`
- Hoàn thành đơn khi chưa thanh toán

**State machine đề xuất:**

```text
pending -> confirmed
pending -> cancelled
confirmed -> completed
confirmed -> cancelled
```

Nếu muốn thực tế hơn:

```text
pending -> confirmed
confirmed -> checked_in
checked_in -> completed
pending/confirmed -> cancelled
```

**Quy tắc cần có:**

- Không sửa đơn `completed` hoặc `cancelled`, trừ chức năng override riêng của admin.
- Chỉ cho `completed` nếu `payment_status = paid`.
- Khi chuyển sang `completed`, gọi logic cộng điểm.

---

### R04 - Race condition khi đặt sân

**Mức độ:** P1

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/User/BookingController.php`
- Hàm `store`

**Vấn đề:**

Kiểm tra trùng lịch đang chạy trước transaction. Sau đó hệ thống mới lock sân và insert booking.

**Kịch bản lỗi:**

```text
Request A kiểm tra slot: còn trống
Request B kiểm tra slot: còn trống
Request A insert booking
Request B insert booking
```

**Rủi ro:**

Hai khách có thể đặt cùng sân, cùng giờ.

**Hướng sửa đề xuất:**

Đưa kiểm tra trùng lịch vào trong transaction, sau khi lock sân:

```php
DB::transaction(function () {
    lock court;
    checkSlotBusy again;
    insert booking;
});
```

---

### R05 - Cash và webhook không dùng chung logic thanh toán

**Mức độ:** P1

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/Admin/BookingController.php`
- `badminton-backend/app/Http/Controllers/Api/Payment/SePayController.php`

**Vấn đề:**

Thanh toán tiền mặt và webhook chuyển khoản cập nhật booking/payment ở hai nơi khác nhau. Logic cộng điểm hiện nằm ở luồng admin cash, không nằm ở webhook.

**Rủi ro:**

Cùng là thanh toán đủ nhưng kết quả hệ thống có thể khác nhau tùy phương thức thanh toán.

**Hướng sửa đề xuất:**

Tách service dùng chung:

```text
PaymentService
BookingStatusService
PointService
```

Admin cash và webhook đều gọi chung service.

---

### R06 - Review chưa có trạng thái kiểm duyệt

**Mức độ:** P1

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/User/ReviewController.php`
- Bảng `reviews`

**Vấn đề:**

Review gửi xong sẽ hiển thị public trên trang chủ. Admin/staff chỉ có thể phản hồi hoặc xóa.

**Rủi ro:**

Nội dung phá hoại hoặc không phù hợp có thể xuất hiện trên trang chủ trước khi staff xử lý.

**Hướng sửa đề xuất:**

Thêm cột:

```sql
status enum('pending','approved','hidden') default 'pending'
created_at timestamp
updated_at timestamp
```

Luồng review:

```text
customer gửi review -> pending
admin/staff duyệt -> approved
homepage chỉ hiển thị approved
admin/staff ẩn -> hidden
```

---

### R07 - Login chưa có rate limit

**Mức độ:** P1

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/AuthController.php`
- Hàm `login`

**Vấn đề:**

Đăng nhập bằng số điện thoại và mật khẩu nhưng chưa giới hạn số lần thử.

**Rủi ro:**

Tài khoản có thể bị brute force password.

**Hướng sửa đề xuất:**

Thêm Laravel RateLimiter:

```text
5 lần/phút theo phone + IP
Sai quá giới hạn -> khóa tạm 60 giây
```

---

### R08 - Staff có quyền quá rộng

**Mức độ:** P1

**Vị trí:**

- `badminton-backend/routes/api.php`
- Group `role:admin,staff`

**Vấn đề:**

Staff hiện có quyền trên nhiều module. Một số hợp lý cho lễ tân, nhưng một số nên kiểm soát chặt hơn như kho, review, khách hàng, voucher.

**Rủi ro:**

Staff có thể thao tác vượt vai trò nghiệp vụ.

**Hướng sửa đề xuất:**

Tách permission:

```text
admin:*
staff:booking.read
staff:booking.update
staff:payment.collect
staff:review.read
staff:review.reply
staff:inventory.read
staff:customer.read
```

Sau đó middleware kiểm tra permission thay vì chỉ kiểm tra role.

---

### R09 - Update địa chỉ dùng request all

**Mức độ:** P1

**Vị trí:**

- `badminton-backend/app/Http/Controllers/Api/AuthController.php`
- Hàm `updateAddress`

**Vấn đề:**

Code đang dùng:

```php
$address->update($request->all());
```

**Rủi ro:**

Đây là pattern không tốt. Nếu sau này request có thêm field ngoài ý muốn và model fillable mở rộng, dữ liệu có thể bị cập nhật sai.

**Hướng sửa:**

```php
$validated = $request->validate([...]);
$address->update($validated);
```

---

### R10 - Encoding tiếng Việt còn lỗi

**Mức độ:** P2

**Vấn đề:**

Một số file vẫn còn text lỗi dạng mojibake, ví dụ:

```text
ÄÄƒng nháº­p
CÃ¡c ca chÆ¡i
```

**Rủi ro:**

- Code khó đọc.
- Thiếu chuyên nghiệp khi nộp source.
- Có thể lỗi message hiển thị.

**Hướng sửa:**

- Chuẩn hóa toàn repo sang UTF-8.
- Sửa toàn bộ message/comment tiếng Việt.
- Tránh thao tác ghi file gây lỗi encoding.

---

### R11 - Controller chứa quá nhiều logic nghiệp vụ

**Mức độ:** P2

**Vấn đề:**

Một số controller đang xử lý quá nhiều việc:

- Đặt sân.
- Tính giá.
- Giảm giá.
- Thanh toán.
- Cộng điểm.
- Kho.
- Notification.

**Rủi ro:**

- Khó test.
- Khó bảo trì.
- Khó giải thích kiến trúc trong khóa luận.

**Hướng sửa:**

Tách service:

```text
BookingService
PricingService
PaymentService
PointService
InventoryService
NotificationService
ReviewService
```

Ưu tiên tách trước:

1. `BookingService`
2. `PaymentService`
3. `PointService`
4. `NotificationService`

---

### R12 - Thiếu test nghiệp vụ cốt lõi

**Mức độ:** P2

**Nên có test cho:**

| Nhóm       | Case cần test                                     |
| ---------- | ------------------------------------------------- |
| Đặt sân    | Không đặt được slot đã có người đặt               |
| Đặt sân    | Không đặt giờ kết thúc nhỏ hơn giờ bắt đầu        |
| Đặt sân    | Không đặt sân đang bảo trì                        |
| Thanh toán | Thanh toán đủ -> `payment_status = paid`          |
| Thanh toán | Thanh toán một phần -> `partially_paid`           |
| Thanh toán | Webhook trùng transaction không tạo payment trùng |
| Điểm       | Đơn `completed + paid` mới cộng điểm              |
| Điểm       | Không cộng điểm trùng                             |
| Review     | Chỉ đơn `completed + paid` mới được đánh giá      |
| Review     | Không đánh giá sân không nằm trong đơn            |
| Review     | Không đánh giá trùng cùng booking/sân             |

---

## 5. Kế Hoạch Sửa Đề Xuất

### Sprint 1 - Sửa lỗi bắt buộc

| Công việc              | Kết quả mong muốn                 |
| ---------------------- | --------------------------------- |
| Xác thực webhook SePay | Không thể giả lập thanh toán      |
| State machine booking  | Không còn chuyển trạng thái sai   |
| Sửa cộng điểm          | Đã chuyển sang lúc đơn hoàn thành |
| Chống cộng điểm trùng  | Đã thêm `points_awarded_at`       |

### Sprint 2 - Chuẩn hóa nghiệp vụ

| Công việc                              | Kết quả mong muốn                       |
| -------------------------------------- | --------------------------------------- |
| Chống double booking trong transaction | Không trùng sân/giờ                     |
| Đồng bộ cash và webhook                | Mọi thanh toán đi chung logic           |
| Thêm `review.status`                   | Review phải được duyệt trước khi public |
| Tách quyền staff                       | Staff chỉ làm đúng phạm vi              |

### Sprint 3 - Hoàn thiện khóa luận

| Công việc              | Kết quả mong muốn                 |
| ---------------------- | --------------------------------- |
| Sửa encoding           | Source dễ đọc, chuyên nghiệp      |
| Tách service           | Kiến trúc rõ ràng hơn             |
| Viết test              | Có bằng chứng nghiệp vụ chạy đúng |
| Chuẩn hóa API response | Frontend dễ xử lý lỗi hơn         |

---

## 6. Kết Luận

Project đã đủ rộng và có nhiều module đúng với đề tài quản lý sân cầu lông. Phần cần nâng cấp quan trọng nhất không còn là giao diện, mà là nghiệp vụ và bảo mật.

Nếu chỉ chọn 4 việc để làm trước khi bảo vệ, nên chọn:

1. Xác thực webhook thanh toán.
2. State machine đơn đặt sân.
3. Cộng điểm đúng lúc đơn hoàn thành.
4. Kiểm duyệt review trước khi hiển thị public.

Hoàn thành 4 điểm này sẽ giúp project thuyết phục hơn rõ rệt khi bị hỏi về tính thực tế, an toàn dữ liệu và kiểm soát nghiệp vụ.
