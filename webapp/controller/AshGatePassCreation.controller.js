sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (BaseController, JSONModel, MessageBox, MessageToast) {
	"use strict";

	return BaseController.extend("zaudgpms.audhatham.com.controller.AshGatePassCreation", {

		onInit: function () {
			var oRouter = this.getRouter();
			oRouter.getRoute("AshGatePassCreation").attachMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function (oEvent) {
			this._initModel();
		},

		_initModel: function () {
			var oDate = new Date();

			// Hardcoded initial data for Ash Gate Pass
			var oData = {
				gpDate: oDate,
				vendor: "",
				vendorAddress: "",
				vendorGST: "",
				VehicleNo: "",
				TransportMode: "Road",
				TransporterName: "",
				TransporterGST: "",
				Remarks: "For Ash disposal to cement plant",
				DCNotes: "For Ash disposal to cement plant",
				finalTotal: "0.00",
				items: [
					{
						sno: "1",
						materialName: "Fly Ash",
						hsnCode: "62100000",
						quantity: "",
						uom: "METRIC TONS",
						rate: "",
						amount: "0.00"
					}
				]
			};

			var oModel = new JSONModel(oData);
			this.getView().setModel(oModel, "ash");
		},

		onNavBack: function () {
			this.getRouter().navTo("home");
		},

		onVendorSelect: function (oEvent) {
			var oModel = this.getView().getModel("ash");
			var sKey = oEvent.getParameter("selectedItem").getKey();

			// Mocking vendor data retrieval
			if (sKey === "V1") {
				oModel.setProperty("/vendorAddress", "Ramco Cement Ltd, Alathiyur Works, P.A.C. Ramaswamy Raja Nagar, Alathiyur, Ariyalur District, India");
				oModel.setProperty("/vendorGST", "33AABCM8375L2Z2");
			} else if (sKey === "V2") {
				oModel.setProperty("/vendorAddress", "123 Domestic Road, Chennai");
				oModel.setProperty("/vendorGST", "33XXXXXXXXXXXXX");
			}
		},

		onTransporterSelect: function (oEvent) {
			var oModel = this.getView().getModel("ash");
			var sKey = oEvent.getParameter("selectedItem").getKey();

			// Mocking transporter data
			if (sKey === "T1") {
				oModel.setProperty("/TransporterGST", "33AEPP2875A2ZV");
			} else if (sKey === "T2") {
				oModel.setProperty("/TransporterGST", "33BBBBBBBBBBBB");
			}
		},

		calculateTotal: function () {
			var oModel = this.getView().getModel("ash");
			var aItems = oModel.getProperty("/items");

			var nTotal = 0;
			aItems.forEach(function (oItem, index) {
				var qty = parseFloat(oItem.quantity) || 0;
				var rate = parseFloat(oItem.rate) || 0;
				var amount = qty * rate;
				oModel.setProperty("/items/" + index + "/amount", amount.toFixed(2));
				nTotal += amount;
			});

			oModel.setProperty("/finalTotal", nTotal.toFixed(2));
		},

		onSubmit: function () {
			var oModel = this.getView().getModel("ash");
			var oData = oModel.getData();

			// Validation
			if (!oData.vendor) { MessageBox.error("Please select a Vendor."); return; }
			if (!oData.VehicleNo) { MessageBox.error("Please enter Vehicle No."); return; }
			if (!oData.TransporterName) { MessageBox.error("Please select a Transporter."); return; }
			if (!oData.items[0].quantity || parseFloat(oData.items[0].quantity) <= 0) {
				MessageBox.error("Please enter a valid Quantity."); return;
			}
			if (!oData.items[0].rate || parseFloat(oData.items[0].rate) <= 0) {
				MessageBox.error("Please enter a valid Rate."); return;
			}

			// Mock saving logic
			sap.ui.core.BusyIndicator.show(0);
			setTimeout(function () {
				sap.ui.core.BusyIndicator.hide();

				// Generate mock Request ID
				var sRequestId = "AGP2024-25/00" + Math.floor(Math.random() * 90 + 10);

				// Here we would normally save to OData. For now we just show success and go back.
				MessageToast.show(sRequestId + " - Added Successfully");

				// Optional: Save to local storage to mock list screen
				var aMockList = JSON.parse(localStorage.getItem("mockAshList") || "[]");
				oData.requestId = sRequestId;
				oData.status = "OPEN"; // Initial status
				aMockList.push(oData);
				localStorage.setItem("mockAshList", JSON.stringify(aMockList));

				this.onNavBack();
			}.bind(this), 1000);
		},

		onPrint: async function () {
			var oModel = this.getView().getModel("ash");
			var oData = oModel.getData();

			const { jsPDF } = window.jspdf;
			var doc = new jsPDF('l', 'mm', 'a4');
			var pageWidth = doc.internal.pageSize.width;
			var margin = 14;

			// Header Logo
			var sLogoUrl = sap.ui.require.toUrl("zgpms/audhatham/com/images/audhataam_logo.png");
			try {
				var sLogoBase64 = await this._getImageBase64(sLogoUrl);
				doc.addImage(sLogoBase64, 'PNG', margin, 10, 30, 11);
			} catch (e) {
				doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(180, 0, 0);
				doc.text("Audhataam", margin, 18); doc.setTextColor(0, 0, 0);
			}

			// Header Text
			doc.setTextColor(0, 0, 0);
			doc.setFont("helvetica", "normal"); doc.setFontSize(16);
			doc.text("Audhataam Pharmaceuticals Private Limited", pageWidth / 2, 14, { align: "center" });
			doc.setFontSize(8);
			doc.text("A Progressive Pharmaceutical & API Company", pageWidth / 2, 19, { align: "center" });
			doc.text("3rd Floor, NCC Building, Durgam Cheruvu Road, Hi-Tech City, Madhapur, Hyderabad, Telangana, 500081, India.", pageWidth / 2, 23, { align: "center" });
			doc.text("GSTIN : 36AABCA8375L1Z1 | CIN : U24239TG2020PTC144888", pageWidth / 2, 27, { align: "center" });

			// Title
			doc.setFontSize(11);
			doc.setFont("helvetica", "bold");
			doc.text("NON-RETURNABLE GATE PASS FOR ASH", pageWidth / 2, 36, { align: "center" });
			var titleW = doc.getTextWidth("NON-RETURNABLE GATE PASS FOR ASH");
			doc.setLineWidth(0.4);
			doc.line(pageWidth / 2 - titleW / 2, 37.5, pageWidth / 2 + titleW / 2, 37.5);

			// Outer Box
			var gridY = 42;
			var gridH = 35;
			doc.setLineWidth(0.3);
			doc.rect(margin, gridY, pageWidth - margin * 2, gridH);
			// Column divider
			doc.line(pageWidth / 2, gridY, pageWidth / 2, gridY + gridH);

			// Left column
			doc.setFontSize(9);
			doc.setFont("helvetica", "normal");
			doc.text("Request ID:", margin + 4, gridY + 6);
			doc.setFont("helvetica", "bold");
			doc.text(oData.requestId || "Draft", margin + 35, gridY + 6);

			doc.setFont("helvetica", "normal");
			doc.text("Transporter Name:", margin + 4, gridY + 14);
			doc.text(oData.TransporterName === "T1" ? "GPR LOGISTICS" : oData.TransporterName === "T2" ? "AUDHATAAM LOGISTICS" : oData.TransporterName || "", margin + 35, gridY + 14);

			doc.text("Transporter GST:", margin + 4, gridY + 22);
			doc.text(oData.TransporterGST || "", margin + 35, gridY + 22);

			doc.text("Transport Mode:", margin + 4, gridY + 30);
			doc.text(oData.TransportMode || "Road", margin + 35, gridY + 30);

			// Right column
			doc.text("Request Date:", pageWidth / 2 + 4, gridY + 6);
			doc.text(oData.gpDate ? oData.gpDate.toLocaleDateString('en-GB') : "", pageWidth / 2 + 35, gridY + 6);

			doc.text("Vendor Name:", pageWidth / 2 + 4, gridY + 14);
			doc.setFont("helvetica", "bold");
			var sVendorName = oData.vendor === "V1" ? "Ramco Cement Ltd" : oData.vendor === "V2" ? "Mock Vendor" : oData.vendor || "";
			doc.text(sVendorName, pageWidth / 2 + 35, gridY + 14);
			doc.setFont("helvetica", "normal");

			doc.text("Vendor GST:", pageWidth / 2 + 4, gridY + 22);
			doc.text(oData.vendorGST || "", pageWidth / 2 + 35, gridY + 22);

			doc.text("Vendor Address:", pageWidth / 2 + 4, gridY + 30);
			var splitAddr = doc.splitTextToSize(oData.vendorAddress || "", pageWidth / 2 - 42);
			doc.text(splitAddr, pageWidth / 2 + 35, gridY + 30);

			// Items Table
			var tableY = gridY + gridH + 4;
			var tableData = (oData.items || []).map(function (it, idx) {
				return [
					it.sno || (idx + 1),
					it.materialName || "",
					it.hsnCode || "",
					parseFloat(it.quantity || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
					it.uom || "",
					parseFloat(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
					parseFloat(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
				];
			});

			doc.autoTable({
				startY: tableY,
				head: [['S.No', 'Material Name', 'HSN Code', 'Quantity', 'UOM', 'Rate (Rs.)', 'Amount (Rs.)']],
				body: tableData,
				theme: 'grid',
				headStyles: {
					fillColor: [220, 220, 220],
					textColor: [0, 0, 0],
					fontStyle: 'bold',
					fontSize: 9,
					halign: 'center'
				},
				bodyStyles: {
					fontSize: 9
				},
				columnStyles: {
					0: { cellWidth: 15, halign: 'center' },
					1: { cellWidth: 'auto' },
					2: { cellWidth: 30, halign: 'center' },
					3: { cellWidth: 30, halign: 'right' },
					4: { cellWidth: 30, halign: 'center' },
					5: { cellWidth: 30, halign: 'right' },
					6: { cellWidth: 35, halign: 'right' }
				},
				margin: { left: margin, right: margin }
			});

			var finalY = doc.lastAutoTable.finalY + 4;

			// Remarks box
			doc.setLineWidth(0.3);
			doc.rect(margin, finalY, pageWidth - margin * 2, 8);
			doc.setFont("helvetica", "bold");
			doc.text("Remarks", margin + 2, finalY + 5);
			doc.setFont("helvetica", "normal");
			doc.text(oData.Remarks || "", margin + 30, finalY + 5);
			doc.line(margin + 28, finalY, margin + 28, finalY + 8);

			// Footer details
			finalY += 14;
			doc.text("Req User:", margin, finalY);
			doc.text("Senthilmurugan R", margin + 30, finalY); // Mock user

			doc.text("Dept:", margin + 80, finalY);
			doc.text("OPERATION", margin + 110, finalY);

			finalY += 8;
			doc.text("Approved By:", margin, finalY);
			doc.text("Selvakumar M", margin + 30, finalY);

			doc.text("Vehicle No:", margin + 80, finalY);
			doc.setFont("helvetica", "bold");
			doc.text(oData.VehicleNo || "", margin + 110, finalY);
			doc.setFont("helvetica", "normal");

			doc.text("Total Value (Rs.):", margin + 160, finalY);
			doc.text(oData.finalTotal || "0.00", margin + 195, finalY);

			finalY += 6;
			doc.text("(Rupees: " + this._numberToWords(Math.round(parseFloat(oData.finalTotal))) + " Only.)", margin + 160, finalY);

			// Signatures
			finalY += 15;
			doc.setFont("helvetica", "bold");
			doc.text("For Audhataam Pharmaceuticals Private Limited", margin, finalY);

			finalY += 15;
			doc.text("Authorised Signatory", margin, finalY);
			doc.text("Receiver's Sign", pageWidth - margin, finalY, { align: "right" });

			doc.save("AGP_" + (oData.requestId || "Draft") + ".pdf");
			MessageToast.show("Gate Pass Downloaded");
		},

		_getImageBase64: function (url) {
			return new Promise(function (resolve, reject) {
				var img = new Image(); img.crossOrigin = "Anonymous";
				img.onload = function () {
					var canvas = document.createElement("canvas");
					canvas.width = img.width; canvas.height = img.height;
					var ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
					resolve(canvas.toDataURL("image/png"));
				};
				img.onerror = function (err) { reject(err); }; img.src = url;
			});
		},

		_numberToWords: function (num) {
			var a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
			var b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
			if ((num = num.toString()).length > 9) return 'overflow';
			var n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
			if (!n) return '';
			var str = '';
			str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
			str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
			str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
			str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
			str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
			return str;
		}

	});
});
