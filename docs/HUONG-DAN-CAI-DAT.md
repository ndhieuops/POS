# Hướng dẫn cài đặt phần mềm bán hàng

Tài liệu này dành cho chủ quán, không cần biết lập trình. Làm lần lượt từng bước.

## 1. Chuẩn bị

- Một máy tính nhỏ (máy chủ) cài Ubuntu 24.04, cắm dây mạng vào bộ định tuyến (router) của quán và luôn bật nguồn.
- Máy tính bảng hoặc màn hình cảm ứng ở mỗi tầng (Tầng 1, Tầng 4), dùng chung mạng Wi-Fi hoặc dây mạng với máy chủ.
- Máy quét mã vạch USB (loại cắm vào là dùng được, giống bàn phím).
- Máy chủ cần có internet **chỉ khi cài đặt**. Khi bán hàng hằng ngày, phần mềm không cần internet.

## 2. Cài đặt

### 2a. Tạo giao diện trên máy tính của bạn (làm một lần, hoặc khi có bản cập nhật)

Máy chủ Ubuntu có sẵn Node quá cũ nên không tự tạo được giao diện. Hãy làm việc này trên máy tính của bạn (đã cài Node 22 trở lên; hoặc nhờ người cài đặt):

```
cd POS/web
npm ci --legacy-peer-deps
npm run build
```

Xong sẽ có thư mục `POS/web/dist`.

### 2b. Cài trên máy chủ

1. Sao chép **cả thư mục `POS`** (đã có `web/dist` ở bước 2a) vào máy chủ, ví dụ vào thư mục chính của bạn.
2. Mở ứng dụng **Terminal** trên máy chủ.
3. Gõ lần lượt hai dòng sau (nhấn Enter sau mỗi dòng):

   ```
   cd POS
   sudo bash deploy/install.sh
   ```

4. Nhập mật khẩu máy chủ nếu được hỏi. Chờ vài phút cho đến khi thấy dòng **"Xong."** Nếu báo thiếu `web/dist`, quay lại bước 2a.
5. Muốn cài lại hoặc cập nhật: chạy lại đúng hai dòng trên. Dữ liệu bán hàng không bị mất.

Sau khi cài xong, phần mềm tự chạy mỗi khi máy chủ bật lên.

## 3. Biết địa chỉ (IP) của máy chủ

Trên máy chủ, gõ:

```
hostname -I
```

Dòng đầu tiên là địa chỉ, ví dụ `192.168.1.20`. Nên nhờ thợ mạng hoặc vào trang quản lý router để **cố định** địa chỉ này, tránh bị đổi khi mất điện.

## 4. Mở phần mềm trên từng màn hình

Trên trình duyệt của mỗi màn hình tầng, mở:

```
http://<ip-máy-chủ>:8080
```

Ví dụ: `http://192.168.1.20:8080`. Thay `<ip-máy-chủ>` bằng địa chỉ ở bước 3. Nên lưu thành dấu trang hoặc thêm vào màn hình chính để mở nhanh.

## 5. Thiết lập lần đầu (làm một lần)

Lần đầu mở, phần mềm hiện màn hình **"Thiết lập cửa hàng"**. Điền:

- **Tên cửa hàng**.
- **Mã PIN chủ quán**: 4 đến 6 chữ số. Chỉ mình bạn biết. Dùng để nhập hàng và đăng ký màn hình.
- **Mã ngân hàng (BIN)**: đúng 6 chữ số, ví dụ Vietcombank là `970436`. Hỏi ngân hàng nếu chưa rõ.
- **Số tài khoản**: từ 1 đến 19 chữ số.
- **Tên chủ tài khoản**.

Bấm **Lưu**. Mã QR chuyển khoản sẽ dùng đúng tài khoản này, số tiền tự điền sẵn khi khách quét.

## 6. Gán mỗi màn hình cho một tầng

Sau khi lưu, màn hình **"Thiết lập thiết bị"** hiện ra (làm trên **từng** màn hình):

1. Nhập mã PIN chủ quán.
2. Gõ **Tên thiết bị**, ví dụ "Quầy tạp hóa".
3. Chọn **Tầng 1** hoặc **Tầng 4**.
4. Bấm **Đăng ký thiết bị**.

Màn hình ở Tầng 1 vào thẳng màn hình bán **Tạp hóa** (không cần chọn dịch vụ). Màn hình ở Tầng 4 hiện **Trà & Kem** và **Pub** để chọn. Màn hình nhớ lựa chọn này; không cần làm lại. (Nếu xóa dữ liệu trình duyệt thì phải đăng ký lại.)

## 7. Máy quét mã vạch USB

1. Cắm máy quét vào cổng USB của màn hình hoặc máy tính bảng (cần đầu chuyển nếu thiếu cổng).
2. Mở màn hình **Tạp hóa**, hướng máy quét vào mã vạch trên hàng. Sản phẩm tự vào giỏ hàng.
3. Không cần bấm vào ô nào trước khi quét.
4. Hàng chưa có trong kho: bấm **Nhập hàng** (nút này chỉ bấm được khi giỏ hàng trống), nhập mã PIN, quét mã, điền tên, giá bán, số lượng, giá nhập rồi bấm **✓ Lưu sản phẩm mới**.
5. Khi cửa sổ mã QR đang mở, máy quét tạm dừng cho đến khi bạn bấm **✓ Đã nhận tiền** (hoặc **💵 Trả tiền mặt**).

## 8. Bán hàng bằng chuyển khoản

1. Quét hàng vào giỏ.
2. Bấm **Thanh toán chuyển khoản (QR)**. Khách quét mã bằng ứng dụng ngân hàng.
3. Khi điện thoại hoặc ứng dụng ngân hàng báo đã nhận tiền, bấm **✓ Đã nhận tiền**.

Cửa sổ QR không có nút hủy, để tránh nhầm. Nếu tải lại trang, mã QR vẫn còn.

### Bán hàng bằng tiền mặt

1. Quét hàng vào giỏ, bấm **Thanh toán tiền mặt**.
2. Cửa sổ **"Khách trả tiền mặt"** hiện tổng tiền. Nhận tiền của khách rồi bấm **✓ Đã nhận tiền mặt**.
3. Bấm nhầm hoặc khách muốn đổi hàng: bấm **Quay lại**, giỏ hàng vẫn giữ nguyên.

## 9. Sao lưu dữ liệu (backup)

- Mỗi đêm lúc **02:30**, máy chủ tự sao chép toàn bộ dữ liệu bán hàng.
- Nơi lưu: thư mục `/var/backups/pos/`. Mỗi ngày một tệp, tên dạng `pos-2026-11-04.db`.
- Giữ **30 ngày**, tệp cũ hơn tự xóa.
- Xem các bản sao lưu: `ls -l /var/backups/pos/`
- Sao lưu ngay lập tức: `sudo systemctl start pos-backup.service`

### Đổi nơi sao lưu sang ổ USB

Nên làm để dữ liệu không nằm chung một ổ cứng với máy chủ.

1. Cắm ổ USB vào máy chủ. Gõ `lsblk -f` để tìm tên ổ (ví dụ `sdb1`) và mã `UUID` của nó.
2. Tạo thư mục gắn ổ: `sudo mkdir -p /mnt/usb-backup`
3. Mở tệp cấu hình gắn ổ tự động: `sudo nano /etc/fstab`, thêm dòng cuối (thay `UUID-CUA-BAN` bằng mã thật, ổ định dạng ext4):

   ```
   UUID=UUID-CUA-BAN  /mnt/usb-backup  ext4  defaults,nofail  0  2
   ```

   Lưu bằng Ctrl+O, Enter, thoát bằng Ctrl+X. Rồi gõ `sudo mount -a`.
4. Cho phép phần mềm ghi vào ổ: `sudo chown pos:pos /mnt/usb-backup`
5. Sửa nơi lưu của tác vụ sao lưu: `sudo systemctl edit pos-backup.service`. Trong cửa sổ hiện ra, dán:

   ```
   [Service]
   Environment=POS_BACKUP_DIR=/mnt/usb-backup
   ```

   Lưu và thoát. Rồi gõ: `sudo systemctl daemon-reload`
6. Thử ngay: `sudo systemctl start pos-backup.service`, rồi `ls /mnt/usb-backup`. Thấy tệp `pos-...db` là thành công.

Nếu rút ổ USB, sao lưu đêm đó sẽ lỗi nhưng việc bán hàng không bị ảnh hưởng. Nhớ cắm lại ổ.

### Khôi phục từ bản sao lưu

Nhờ người rành kỹ thuật: dừng phần mềm (`sudo systemctl stop pos`), chép tệp sao lưu đè lên `/var/lib/pos/pos.db`, đặt chủ sở hữu `sudo chown pos:pos /var/lib/pos/pos.db`, rồi bật lại (`sudo systemctl start pos`).

## 10. Xem nhật ký của máy chủ (khi có sự cố)

Trên máy chủ, mở Terminal và gõ:

```
sudo journalctl -u pos -n 100 --no-pager
```

Lệnh này hiện 100 dòng gần nhất. Xem liên tục: `sudo journalctl -u pos -f` (thoát bằng Ctrl+C). Xem nhật ký sao lưu: `sudo journalctl -u pos-backup`.

## 11. Các lệnh hay dùng

| Việc cần làm | Lệnh |
| --- | --- |
| Xem phần mềm có đang chạy không | `systemctl status pos` |
| Khởi động lại phần mềm | `sudo systemctl restart pos` |
| Kiểm tra lịch sao lưu | `systemctl list-timers pos-backup.timer` |

## 12. Gặp sự cố thường gặp

- **Màn hình báo "Mất kết nối với máy chủ"**: kiểm tra máy chủ còn bật, dây mạng còn cắm, và địa chỉ IP chưa đổi. Bấm **Thử lại**.
- **Quét mã không vào giỏ**: kiểm tra máy quét còn cắm. Có thể gõ mã vào ô "Quét mã vạch hoặc nhập mã" rồi nhấn Enter.
- **Quên mã PIN chủ quán**: xem mục "Quên mã PIN" ngay dưới đây.

### Quên mã PIN

Trên máy chủ, mở Terminal và gõ (một dòng):

```
sudo -u pos env POS_DB_PATH=/var/lib/pos/pos.db /opt/pos/server/.venv/bin/python -m pos.reset_pin
```

1. Nhập mã PIN mới (4 đến 6 chữ số) rồi nhấn Enter. Khi gõ, màn hình không hiện số; đó là bình thường.
2. Nhập lại mã PIN mới lần nữa rồi nhấn Enter.
3. Thấy dòng **"Đã đặt lại mã PIN chủ quán"** là xong. Không cần khởi động lại phần mềm.

Lệnh này cũng xóa các lần nhập sai trước đó, nên màn hình đang bị khóa vì nhập sai nhiều lần sẽ dùng được ngay. Phiên chủ quán đang mở (nếu có) sẽ phải nhập lại mã PIN mới.
