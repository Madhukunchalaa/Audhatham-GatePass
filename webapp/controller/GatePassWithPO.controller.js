sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, MessageBox, MessageToast, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("zaudgpms.audhatham.com.controller.GatePassWithPO", {

		onInit: function () {
			this._resetModel();
			this.getRouter().getRoute("GatePassWithPO").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function () {
			this._resetModel();

			var oModel = this.getView().getModel("gpo");
			if (oModel) {
				var oUserModel = sap.ui.getCore().getModel("user");
				if (oUserModel) {
					var sPlant = oUserModel.getProperty("/Plant");
					var sDept = oUserModel.getProperty("/Department");

					if (sPlant) {
						oModel.setProperty("/Plant", sPlant);
						this._loadVendors(sPlant);
					}
					if (sDept) { oModel.setProperty("/Department", sDept); }
				}
			}
		},

		_resetModel: function () {
			var oModel = this.getView().getModel("gpo");
			var oYesterday = new Date();
			oYesterday.setDate(oYesterday.getDate() - 1);
			var sYesterday = oYesterday.getFullYear() + "-" +
				String(oYesterday.getMonth() + 1).padStart(2, "0") + "-" +
				String(oYesterday.getDate()).padStart(2, "0");

			var oData = {
				GEDate: sYesterday,
				SourceType: "",
				Vendor: "",
				VendorDesc: "",
				Plant: "",
				Department: "",
				PurchaseOrder: "",
				RGPNumber: "",
				DCNumber: "",
				DCdate: sYesterday,
				PCPNo: "",
				BudgetCode: "",
				TotalCost: "",
				RRNo: "",
				InspectionStatus: "Pending",
				Inspectiondate: "",
				Remarks: "",
				GateEntryNo: "",
				GatePassNo: "",
				Message: "",
				GateInPoNav: []
			};
			if (!oModel) {
				this.getView().setModel(new JSONModel(oData), "gpo");
			} else {
				oModel.setData(oData);
			}
		},

		_formatDateToSAP: function (sDate) {
			if (!sDate) {
				return "";
			}
			if (typeof sDate === "string" && sDate.length === 8 && !isNaN(sDate)) {
				return sDate;
			}
			var oDate = new Date(sDate);
			if (isNaN(oDate.getTime())) {
				return "";
			}
			var sYear = oDate.getFullYear();
			var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
			var sDay = String(oDate.getDate()).padStart(2, "0");
			return sYear + sMonth + sDay;
		},

		_formatDateToHyphens: function (sDate) {
			if (!sDate) {
				return "";
			}
			var oDate = new Date(sDate);
			if (isNaN(oDate.getTime())) {
				return "";
			}
			var sYear = oDate.getFullYear();
			var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
			var sDay = String(oDate.getDate()).padStart(2, "0");
			return sYear + "-" + sMonth + "-" + sDay;
		},

		onSourceTypeChange: function () {
			// Reserved for source-type-specific logic if needed
		},

		onVendorChange: function () {
			// Reserved for vendor lookup if needed
		},

		onPlantChange: function (oEvent) {
			var sPlant = (oEvent.getParameter("value") || "").trim().toUpperCase();
			var oModel = this.getView().getModel("gpo");
			if (oModel) {
				oModel.setProperty("/Plant", sPlant);
				this._loadVendors(sPlant);
			}
		},

		onVendorSelect: function (oEvent) {
			var oItem = oEvent.getParameter("selectedItem");
			var oModel = this.getView().getModel("gpo");
			if (!oModel) { return; }

			if (!oItem) {
				oModel.setProperty("/VendorDesc", "");
				return;
			}

			var sVendorKey = oItem.getKey();
			var oVendorModel = this.getView().getModel("vendors");
			var aVendors = (oVendorModel) ? oVendorModel.getProperty("/results") : [];
			var oVendor = aVendors.find(function (v) { return v.Vendor === sVendorKey; });
			if (oVendor) {
				oModel.setProperty("/VendorDesc", oVendor.VendorName || "");
			}
		},

		_loadVendors: function (sPlant) {
			var oVendorModel = new JSONModel({ results: [] });
			this.getView().setModel(oVendorModel, "vendors");

			if (!sPlant) { return; }

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

			oODataModel.read("/ZVendorSet", {
				filters: aFilters,
				success: function (oData) {
					var aResults = oData.results || [];
					if (aResults.length === 0) { return; }
					var aNormalized = aResults.map(function (v) {
						return {
							Vendor: v.Vendor || v.Lifnr || "",
							VendorName: v.Name || v.VendorName || v.Name1 || "Unknown Vendor",
							Street: v.Address || v.Street || "",
							City: v.City || "",
							PostalCode: v.ZipCode || v.PostalCode || "",
							Country: v.Country || "",
							VendorGST: v.VendorGST || v.TaxNumber1 || ""
						};
					});
					oVendorModel.setProperty("/results", aNormalized);
				},
				error: function (oError) {
					MessageBox.error("Failed to load vendors. Please try again.");
				}
			});
		},

		onPOChange: function (oEvent) {
			var oModel = this.getView().getModel("gpo");
			var sPO = (oModel.getProperty("/PurchaseOrder") || "").trim();
			var sPlant = (oModel.getProperty("/Plant") || "").trim();

			if (!sPO) {
				return;
			}
			if (!sPlant) {
				MessageToast.show("Please enter Plant first to fetch PO details.");
				return;
			}

			var oODataModel = this.getOwnerComponent().getModel();
			// Example: /GateInPoHdrSet(PurchaseOrder='4000003222',Plant='2301')
			var sPath = "/GateInPoHdrSet(PurchaseOrder='" + sPO + "',Plant='" + sPlant + "')";

			sap.ui.core.BusyIndicator.show(0);
			oODataModel.read(sPath, {
				urlParameters: {
					"$expand": "GateInPoNav"
				},
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					if (oData) {
						if (oData.Vendor) { oModel.setProperty("/Vendor", oData.Vendor); }
						if (oData.VendorDesc) { oModel.setProperty("/VendorDesc", oData.VendorDesc); }
						if (oData.Department) { oModel.setProperty("/Department", oData.Department); }
						oModel.setProperty("/SourceType", "PO"); // Force source type to PO
						if (oData.DCNumber) { oModel.setProperty("/DCNumber", oData.DCNumber); }
						if (oData.RRNo) { oModel.setProperty("/RRNo", oData.RRNo); }

						if (oData.InspectionStatus) {
							oModel.setProperty("/InspectionStatus", oData.InspectionStatus);
						}

						if (oData.Inspectiondate) {
							// Check if the date is valid before setting, else leave it empty
							var parsedDate = new Date(oData.Inspectiondate);
							if (!isNaN(parsedDate.getTime())) {
								var sYear = parsedDate.getFullYear();
								var sMonth = String(parsedDate.getMonth() + 1).padStart(2, "0");
								var sDay = String(parsedDate.getDate()).padStart(2, "0");
								oModel.setProperty("/Inspectiondate", sYear + "-" + sMonth + "-" + sDay);
							}
						}

						// Auto-fill the items table
						var aItems = [];
						if (oData.GateInPoNav && oData.GateInPoNav.results) {
							aItems = oData.GateInPoNav.results.map(function (item, idx) {
								var sItemNo = item.ItemNo || item.Itemno || item.PurchaseOrderItem || item.POItem || "";
								if (!sItemNo) {
									sItemNo = String((idx + 1) * 10);
								}
								if (/^0+\d+$/.test(sItemNo)) {
									sItemNo = String(parseInt(sItemNo, 10));
								}
								return {
									ItemNo: sItemNo,
									ItemDescription: item.ItemDescription || "",
									POQuantity: item.POQuantity || "",
									UOM: item.UOM || "",
									PurchaseOrder: item.PurchaseOrder || sPO,
									Plant: item.Plant || sPlant,
									GatePassNo: item.GatePassNo || "",
									RecievedQuantity: item.RecievedQuantity || ""
								};
							});
						}
						oModel.setProperty("/GateInPoNav", aItems);
						MessageToast.show("PO details auto-filled successfully.");
					}
				}.bind(this),
				error: function (oError) {
					sap.ui.core.BusyIndicator.hide();
					var sErrMsg = "Failed to fetch PO details.";
					try {
						var oErrBody = JSON.parse(oError.responseText);
						sErrMsg = oErrBody.error.message.value || sErrMsg;
					} catch (e) { /* ignore */ }
					MessageBox.error(sErrMsg);
				}
			});
		},

		onPOValueHelp: function () {
			var oModel = this.getView().getModel("gpo");
			var sPlant = (oModel.getProperty("/Plant") || "").trim();

			if (!sPlant) {
				MessageToast.show("Please enter Plant first.");
				return;
			}

			if (!this.getView().getModel("pos")) {
				this.getView().setModel(new JSONModel({ results: [] }), "pos");
			}

			if (!this._pPOValueHelp) {
				this._pPOValueHelp = sap.ui.core.Fragment.load({
					id: this.getView().getId(),
					name: "zaudgpms.audhatham.com.view.fragments.POValueHelp",
					controller: this
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					return oDialog;
				}.bind(this));
			}

			var oODataModel = this.getOwnerComponent().getModel();
			sap.ui.core.BusyIndicator.show(0);

			oODataModel.read("/GateInPoHdrSet", {
				filters: [new Filter("Plant", FilterOperator.EQ, sPlant)],
				urlParameters: { "$expand": "GateInPoNav" },
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					this.getView().getModel("pos").setProperty("/results", oData.results || []);
					this._pPOValueHelp.then(function (oDialog) {
						oDialog.getBinding("items").filter([]);
						oDialog.open();
					});
				}.bind(this),
				error: function () {
					sap.ui.core.BusyIndicator.hide();
					MessageToast.show("Failed to load POs for Plant " + sPlant);
				}
			});
		},

		onPOValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter({
				filters: [
					new Filter("PurchaseOrder", FilterOperator.Contains, sValue),
					new Filter("Vendor", FilterOperator.Contains, sValue),
					new Filter("VendorDesc", FilterOperator.Contains, sValue)
				],
				and: false
			});
			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onPOValueHelpConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (!oSelectedItem) {
				return;
			}

			var oSelectedPO = oSelectedItem.getBindingContext("pos").getObject();
			var oModel = this.getView().getModel("gpo");

			if (oSelectedPO) {
				oModel.setProperty("/PurchaseOrder", oSelectedPO.PurchaseOrder || "");
				oModel.setProperty("/Vendor", oSelectedPO.Vendor || "");
				oModel.setProperty("/VendorDesc", oSelectedPO.VendorDesc || "");
				if (oSelectedPO.Department) {
					oModel.setProperty("/Department", oSelectedPO.Department);
				}
				oModel.setProperty("/SourceType", "PO"); // Force source type to PO
				oModel.setProperty("/DCNumber", oSelectedPO.DCNumber || "");
				oModel.setProperty("/RRNo", oSelectedPO.RRNo || "");

				if (oSelectedPO.InspectionStatus) {
					oModel.setProperty("/InspectionStatus", oSelectedPO.InspectionStatus);
				}

				if (oSelectedPO.Inspectiondate) {
					var parsedDate = new Date(oSelectedPO.Inspectiondate);
					if (!isNaN(parsedDate.getTime())) {
						var sYear = parsedDate.getFullYear();
						var sMonth = String(parsedDate.getMonth() + 1).padStart(2, "0");
						var sDay = String(parsedDate.getDate()).padStart(2, "0");
						oModel.setProperty("/Inspectiondate", sYear + "-" + sMonth + "-" + sDay);
					}
				}

				// Auto-fill the items table
				var aItems = [];
				if (oSelectedPO.GateInPoNav && oSelectedPO.GateInPoNav.results) {
					aItems = oSelectedPO.GateInPoNav.results.map(function (item, idx) {
						var sItemNo = item.ItemNo || item.Itemno || item.PurchaseOrderItem || item.POItem || "";
						if (!sItemNo) {
							sItemNo = String((idx + 1) * 10);
						}
						if (/^0+\d+$/.test(sItemNo)) {
							sItemNo = String(parseInt(sItemNo, 10));
						}
						return {
							ItemNo: sItemNo,
							ItemDescription: item.ItemDescription || "",
							POQuantity: item.POQuantity || "",
							UOM: item.UOM || "",
							PurchaseOrder: item.PurchaseOrder || oSelectedPO.PurchaseOrder,
							Plant: item.Plant || oSelectedPO.Plant,
							GatePassNo: item.GatePassNo || "",
							RecievedQuantity: item.RecievedQuantity || ""
						};
					});
				}
				oModel.setProperty("/GateInPoNav", aItems);
				MessageToast.show("PO details auto-filled successfully.");
			}
		},

		onPOValueHelpCancel: function () { },

		onAddItem: function () {
			var oModel = this.getView().getModel("gpo");
			var aItems = oModel.getProperty("/GateInPoNav") || [];
			var idx = aItems.length;
			var sNextItemNo = String((idx + 1) * 10);
			aItems.push({
				ItemNo: sNextItemNo,
				ItemDescription: "",
				POQuantity: "",
				UOM: "",
				PurchaseOrder: "",
				Plant: "",
				GatePassNo: "",
				RecievedQuantity: ""
			});
			oModel.setProperty("/GateInPoNav", aItems);
		},

		onDeleteItem: function (oEvent) {
			var oModel = this.getView().getModel("gpo");
			var aItems = oModel.getProperty("/GateInPoNav");
			var oCtx = oEvent.getSource().getBindingContext("gpo");
			var iIdx = parseInt(oCtx.getPath().split("/").pop());
			aItems.splice(iIdx, 1);
			oModel.setProperty("/GateInPoNav", aItems.slice());
		},

		onReset: function () {
			this._resetModel();
		},

		_isPOFlow: function () {
			var oModel = this.getView().getModel("gpo");
			var sSourceType = (oModel ? oModel.getProperty("/SourceType") : "") || "";
			sSourceType = sSourceType.toUpperCase().trim();
			return sSourceType === "PO";
		},

		_isPCPFlow: function () {
			var oModel = this.getView().getModel("gpo");
			var sSourceType = (oModel ? oModel.getProperty("/SourceType") : "") || "";
			sSourceType = sSourceType.toUpperCase().trim();
			return sSourceType === "PETTY CASH" || sSourceType === "PETTYCASH" || sSourceType === "PCP";
		},

		onSubmit: function () {
			if (this._isPOFlow()) {
				this._submitPOFlow();
			} else if (this._isPCPFlow()) {
				this._submitPCPFlow();
			} else {
				// Fallback robustness check: if a PO number is present, treat as PO flow
				var oModel = this.getView().getModel("gpo");
				if (oModel && oModel.getProperty("/PurchaseOrder")) {
					this._submitPOFlow();
				} else {
					MessageBox.error("Please select a Source Type (PO or Petty Cash) before submitting.");
				}
			}
		},

		// =========================================================================
		// PO Workflow Implementation Methods
		// =========================================================================

		_validatePO: function (oData) {
			if (!oData.GEDate) {
				MessageBox.error("Please enter GE Date.");
				return false;
			}
			if (!oData.Plant) {
				MessageBox.error("Please enter Plant.");
				return false;
			}
			if (!oData.Department) {
				MessageBox.error("Please enter Department.");
				return false;
			}
			if (!oData.GateInPoNav || oData.GateInPoNav.length === 0) {
				MessageBox.error("Please add at least one item.");
				return false;
			}
			return true;
		},

		_preparePOPayload: function (oData) {
			var sPlant = oData.Plant;
			var sPO = oData.PurchaseOrder;

			var aNavItems = oData.GateInPoNav.map(function (oItem) {
				return {
					PurchaseOrder: sPO || "",
					Plant: sPlant,
					ItemNo: oItem.ItemNo || "",
					ItemDescription: oItem.ItemDescription || "",
					POQuantity: oItem.POQuantity ? String(oItem.POQuantity) : "0.000",
					UOM: oItem.UOM || "",
					GatePassNo: "",
					RecievedQuantity: oItem.RecievedQuantity ? String(oItem.RecievedQuantity) : "0.000"
				};
			});

			var sGEDate = this._formatDateToSAP(oData.GEDate);
			var sInspectionDate = this._formatDateToSAP(oData.Inspectiondate);

			return {
				PurchaseOrder: sPO || "",
				Plant: sPlant,
				SourceType: oData.SourceType || "PO",
				Vendor: oData.Vendor || "",
				VendorDesc: oData.VendorDesc || "",
				Department: oData.Department || "",
				DCNumber: oData.DCNumber || "",
				RRNo: oData.RRNo || "",
				InspectionStatus: oData.InspectionStatus || "Pending",
				Inspectiondate: sInspectionDate,
				Remarks: oData.Remarks || "",
				GateEntryNo: "",
				GEDate: sGEDate,
				Message: "",
				PCPNo: oData.PCPNo || "",
				BudgetCode: oData.BudgetCode || "",
				GateInPoNav: aNavItems
			};
		},

		_submitPOFlow: function () {
			var oModel = this.getView().getModel("gpo");
			var oData = oModel.getData();

			if (!this._validatePO(oData)) {
				return;
			}

			var oPayload = this._preparePOPayload(oData);
			this._executeODataCreate("/GateInPoHdrSet", oPayload);
		},

		// =========================================================================
		// Petty Cash Purchase (PCP) Workflow Implementation Methods
		// =========================================================================

		_validatePCP: function (oData) {
			if (!oData.GEDate) {
				MessageBox.error("Please enter GE Date.");
				return false;
			}
			if (!oData.Plant) {
				MessageBox.error("Please enter Plant.");
				return false;
			}
			if (!oData.Department) {
				MessageBox.error("Please enter Department.");
				return false;
			}
			if (!oData.VendorDesc) {
				MessageBox.error("Please enter Vendor Name.");
				return false;
			}
			var fTotalCost = parseFloat(oData.TotalCost || 0);
			if (fTotalCost > 5000) {
				MessageBox.error("Total Cost for Petty Cash Purchase cannot exceed 5000.");
				return false;
			}
			if (!oData.GateInPoNav || oData.GateInPoNav.length === 0) {
				MessageBox.error("Please add at least one material item.");
				return false;
			}
			return true;
		},

		_preparePCPPayload: function (oData) {
			var sPlant = oData.Plant;
			var sGEDateSAP = this._formatDateToSAP(oData.GEDate);
			var sDCDateSAP = oData.DCdate ? this._formatDateToSAP(oData.DCdate) : sGEDateSAP;

			var aNavItems = oData.GateInPoNav.map(function (oItem, idx) {
				var sQty = oItem.RecievedQuantity || oItem.POQuantity || "0.000";

				var sItemNo = oItem.ItemNo || String((idx + 1) * 10);
				if (/^\d+$/.test(sItemNo)) {
					sItemNo = String(sItemNo).padStart(5, "0");
				}

				return {
					PCPNo: oData.PCPNo || "",
					SourceType: "PettyCash",
					ItemNo: sItemNo,
					ItemDescription: oItem.ItemDescription || "",
					RecievedQuantity: String(parseFloat(sQty).toFixed(3)),
					UOM: oItem.UOM || "",
					TotalCost: oData.TotalCost ? String(parseFloat(oData.TotalCost).toFixed(2)) : "0.00",
					GateEntryNo: oData.GateEntryNo || ""
				};
			});

			return {
				PCPNo: oData.PCPNo || "",
				GEDate: sGEDateSAP,
				Plant: sPlant,
				Vendor: oData.Vendor || "",
				VendorDesc: oData.VendorDesc || "",
				SourceType: "PettyCash",
				Department: oData.Department || "",
				DCNumber: oData.DCNumber || "",
				PurchaseOrder: oData.PurchaseOrder || "",
				RRNo: oData.RRNo || "",
				GateEntryNo: oData.GateEntryNo || "",
				PCPDate: sGEDateSAP,
				DCdate: sDCDateSAP,
				BudgetCode: oData.BudgetCode || "",
				EntryPoint: "",
				InspectionStatus: "",
				Inspectiondate: "",
				Remarks: oData.Remarks || "",
				Message: "",
				PCPItmNav: aNavItems
			};
		},

		_submitPCPFlow: function () {
			var oModel = this.getView().getModel("gpo");
			var oData = oModel.getData();

			if (!this._validatePCP(oData)) {
				return;
			}

			var oPayload = this._preparePCPPayload(oData);
			console.log("PETTY CASH POST PAYLOAD:", JSON.stringify(oPayload, null, 2));
			this._executeODataCreate("/PCPHdrSet", oPayload);
		},

		// =========================================================================
		// Reusable Core OData Submission Executor
		// =========================================================================

		_executeODataCreate: function (sEntitySet, oPayload) {
			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) {
				MessageBox.error("OData model not available. Please refresh and try again.");
				return;
			}

			sap.ui.core.BusyIndicator.show(0);

			try {
				oODataModel.create(sEntitySet, oPayload, {
					success: function (oResponse) {
						sap.ui.core.BusyIndicator.hide();
						var sMsg = (oResponse && oResponse.Message) ? oResponse.Message : "Success";
						MessageToast.show(sMsg);
						this._resetModel();
					}.bind(this),
					error: function (oError) {
						sap.ui.core.BusyIndicator.hide();
						var sErrMsg = "Failed to create Gate Entry.";
						var sDetailedError = "";
						try {
							var oErrBody = JSON.parse(oError.responseText);
							sErrMsg = (oErrBody.error && oErrBody.error.message && oErrBody.error.message.value) ? oErrBody.error.message.value : sErrMsg;

							if (oErrBody.error && oErrBody.error.innererror) {
								var oInner = oErrBody.error.innererror;
								if (oInner.errordetails && oInner.errordetails.length > 0) {
									var aDetails = oInner.errordetails.map(function (d) {
										return d.message;
									}).filter(Boolean);

									aDetails = aDetails.filter(function (msg) {
										return msg.indexOf("Error_Resolution") === -1 && msg.indexOf("SAP_Note") === -1 && msg.indexOf("/IWFND/ERROR_LOG") === -1;
									});

									if (aDetails.length > 0) {
										sDetailedError = "\n\nBackend details:\n" + aDetails.join("\n");
									}
								}
								if (!sDetailedError && oInner.transactionid) {
									sDetailedError = "\n\nTransaction ID: " + oInner.transactionid;
								}
							}
						} catch (e) {
							if (oError.responseText) {
								sDetailedError = "\n\nResponse details:\n" + oError.responseText;
							} else if (oError.message) {
								sDetailedError = "\n\nDetails: " + oError.message;
							}
						}
						MessageBox.error(sErrMsg + sDetailedError);
					}
				});
			} catch (oSyncError) {
				sap.ui.core.BusyIndicator.hide();
				MessageBox.error("Submission failed: " + (oSyncError.message || oSyncError));
			}
		},

		onNavHome: function () {
			this.getRouter().navTo("home");
		},

		onPrint: async function () {
			var oData = this.getView().getModel("gpo").getData();
			const { jsPDF } = window.jspdf;
			
			// Landscape A4
			var doc = new jsPDF('l', 'mm', 'a4');
			var pageWidth = doc.internal.pageSize.width;    // 297mm
			var pageHeight = doc.internal.pageSize.height;  // 210mm
			var margin = 12;
			var contentWidth = pageWidth - margin * 2;       // 273mm

			// Date formatting
			var fnDisplayDate = function (vDate) {
				if (!vDate) return "";
				var d = (vDate instanceof Date) ? vDate : new Date(vDate);
				if (isNaN(d.getTime())) return String(vDate);
				return d.toLocaleDateString("en-GB").split("/").join("-");
			};

			var sDate = fnDisplayDate(oData.GEDate) || new Date().toLocaleDateString('en-GB').split('/').join('-');
			
			var sTitle = "GATE ENTRY - " + (oData.SourceType === "PettyCash" ? "PETTY CASH PURCHASE" : "AGAINST PO");

			// ── PAGE BORDER ──────────────────────────────────────────────────────
			doc.setLineWidth(0.6);
			doc.rect(7, 5, pageWidth - 14, pageHeight - 10);
			doc.setLineWidth(0.2);
			doc.rect(8.5, 6.5, pageWidth - 17, pageHeight - 13);

			// ── HEADER ───────────────────────────────────────────────────────────
			var sLogoUrl = sap.ui.require.toUrl("zgpms/audhatham/com/images/audhataam_logo.png");
			try {
				var sLogoBase64 = await this._getImageBase64(sLogoUrl);
				doc.addImage(sLogoBase64, 'PNG', margin, 9, 32, 12);
			} catch (e) {
				doc.setFont("helvetica", "bold");
				doc.setFontSize(18);
				doc.setTextColor(35, 93, 159);
				doc.text("Audhataam", margin, 18);
				doc.setTextColor(0, 0, 0);
			}

			doc.setTextColor(0, 0, 0);
			doc.setFont("helvetica", "bold");
			doc.setFontSize(14);
			doc.text("Audhataam Pharmaceuticals Private Limited", pageWidth / 2, 13, { align: "center" });
			doc.setFont("helvetica", "normal");
			doc.setFontSize(7.5);
			doc.text("A Progressive Pharmaceutical & API Company", pageWidth / 2, 17, { align: "center" });
			doc.text("3rd Floor, NCC Building, Durgam Cheruvu Road, Hi-Tech City, Madhapur, Hyderabad, Telangana, 500081, India.", pageWidth / 2, 20.5, { align: "center" });
			doc.text("Tel : +91-40-67151000  |  Email : info@audhataam.com", pageWidth / 2, 24, { align: "center" });
			doc.setFont("helvetica", "bold");
			doc.text("GSTIN : 36AABCA8375L1Z1  |  CIN : U24239TG2020PTC144888", pageWidth / 2, 27.5, { align: "center" });

			// GP No + Date in top-right corner
			doc.setFontSize(8.5);
			doc.setFont("helvetica", "bold");
			doc.text("GE No : " + (oData.GateEntryNo || oData.PCPNo || "Draft"), pageWidth - margin, 12, { align: "right" });
			doc.setFont("helvetica", "normal");
			doc.text("Date : " + sDate, pageWidth - margin, 17, { align: "right" });

			// Thick separator below header
			doc.setLineWidth(0.5);
			doc.line(margin, 30.5, pageWidth - margin, 30.5);

			// ── DOCUMENT TITLE ───────────────────────────────────────────────────
			doc.setFont("helvetica", "bold");
			doc.setFontSize(11);
			doc.text(sTitle, pageWidth / 2, 37, { align: "center" });
			var titleW = doc.getTextWidth(sTitle);
			doc.setLineWidth(0.35);
			doc.line(pageWidth / 2 - titleW / 2, 38.5, pageWidth / 2 + titleW / 2, 38.5);

			// ── INFO GRID ────────────────────────────────────────────────────────
			var gridY = 41, gridH = 32;
			var lColW = 148, rColW = contentWidth - lColW;
			var lColX = margin, rColX = margin + lColW;
			var pad = 3, rLH = 5.5;

			doc.setLineWidth(0.3);
			doc.rect(lColX, gridY, contentWidth, gridH);
			doc.line(rColX, gridY, rColX, gridY + gridH);
			
			// Horizontal divider inside left col
			doc.setLineWidth(0.2);
			doc.line(lColX, gridY + 9, rColX, gridY + 9);

			// Left col top row — Please Allow / Received from
			doc.setFontSize(8.5);
			doc.setFont("helvetica", "normal");
			doc.text("Received From:", lColX + pad, gridY + 6);
			doc.setFont("helvetica", "bold");
			doc.text(oData.VendorDesc || "", lColX + 34, gridY + 6);

			// Left col body — Vendor details
			doc.setFontSize(8.5);
			doc.setFont("helvetica", "bold");
			doc.text(oData.VendorDesc || "", lColX + pad, gridY + 14);
			doc.setFont("helvetica", "normal");
			doc.text("Vendor Code: " + (oData.Vendor || "N/A"), lColX + pad, gridY + 19.5);
			doc.setFont("helvetica", "italic");
			doc.setFontSize(8);
			doc.text("to bring in the following material to Audhataam premises.", lColX + pad, gridY + gridH - 3.5);

			// Right col — Document details
			var rc = rColX + pad, ry = gridY + 6;
			var lblOff = 30;
			doc.setFontSize(8.5);
			doc.setFont("helvetica", "bold"); doc.text("PO Number:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text(oData.PurchaseOrder || "N/A", rc + lblOff, ry);
			ry += rLH;
			doc.setFont("helvetica", "bold"); doc.text("Source:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text(oData.SourceType || "PO", rc + lblOff, ry);
			ry += rLH;
			doc.setFont("helvetica", "bold"); doc.text("Department:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text(oData.Department || "STORES", rc + lblOff, ry);
			ry += rLH;
			doc.setFont("helvetica", "bold"); doc.text("Plant:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text(oData.Plant || "", rc + lblOff, ry);
			ry += rLH;
			doc.setFont("helvetica", "bold"); doc.text("DC / Inv No:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text(oData.DCNumber || "", rc + lblOff, ry);

			// ── ITEMS TABLE ──────────────────────────────────────────────────────
			var tableData = (oData.GateInPoNav || []).map(function (it, i) {
				var sQty = it.RecievedQuantity || it.POQuantity || "0.00";
				return [
					i + 1,
					it.ItemDescription || "",
					it.ItemNo || "",
					parseFloat(sQty).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
					it.UOM || ""
				];
			});
			while (tableData.length < 6) { tableData.push(["", "", "", "", ""]); }

			doc.autoTable({
				startY: gridY + gridH + 1,
				head: [['S.No', 'DESCRIPTION OF GOODS', 'Item Number', 'Quantity', 'UOM']],
				body: tableData,
				theme: 'grid',
				headStyles: {
					fillColor: [235, 235, 235],
					textColor: [0, 0, 0],
					fontStyle: 'bold',
					fontSize: 8.5,
					halign: 'center',
					valign: 'middle',
					cellPadding: 3,
					lineWidth: 0.3,
					lineColor: [0, 0, 0]
				},
				bodyStyles: {
					fontSize: 8.5,
					cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
					lineColor: [0, 0, 0],
					lineWidth: 0.25,
					valign: 'middle'
				},
				alternateRowStyles: { fillColor: [250, 250, 250] },
				columnStyles: {
					0: { cellWidth: 14, halign: 'center' },
					1: { cellWidth: 'auto', halign: 'left' },
					2: { cellWidth: 40, halign: 'center' },
					3: { cellWidth: 40, halign: 'right' },
					4: { cellWidth: 30, halign: 'center' }
				},
				margin: { left: margin, right: margin }
			});

			var finalY = doc.lastAutoTable.finalY;

			// ── REMARKS / FINANCIAL INFO ROW ──────────────────────────────────────
			var remY = finalY + 1, remH = 10;
			doc.setLineWidth(0.25);
			doc.rect(margin, remY, contentWidth, remH);
			doc.line(margin + 120, remY, margin + 120, remY + remH);
			doc.setFont("helvetica", "bold"); doc.setFontSize(8);
			doc.text("Remarks:", margin + 3, remY + 6);
			doc.setFont("helvetica", "normal");
			doc.text(doc.splitTextToSize(oData.Remarks || "NIL", 112), margin + 18, remY + 6);

			if (oData.SourceType === "PettyCash") {
				var fCost = parseFloat(oData.TotalCost) || 0;
				doc.setFont("helvetica", "bold");
				doc.text("Total Cost:", margin + 123, remY + 4);
				doc.setFont("helvetica", "normal");
				doc.text("Rs. " + fCost.toFixed(2), margin + 145, remY + 4);

				doc.setFont("helvetica", "bold");
				doc.text("Budget Code:", margin + 123, remY + 8);
				doc.setFont("helvetica", "normal");
				doc.text(oData.BudgetCode || "N/A", margin + 145, remY + 8);
			} else {
				doc.setFont("helvetica", "bold");
				doc.text("RR Number:", margin + 123, remY + 6);
				doc.setFont("helvetica", "normal");
				doc.text(oData.RRNo || "N/A", margin + 145, remY + 6);
			}

			// ── META INFO ROW ─────────────────────────────────────────────────────
			var metaY = remY + remH + 3;
			doc.setFontSize(8);
			doc.setFont("helvetica", "bold"); doc.text("Gate Entry No:", margin, metaY);
			doc.setFont("helvetica", "normal"); doc.text(oData.GateEntryNo || "Draft", margin + 24, metaY);
			doc.setFont("helvetica", "bold"); doc.text("RGP Number:", margin + 70, metaY);
			doc.setFont("helvetica", "normal"); doc.text(oData.RGPNumber || "N/A", margin + 92, metaY);
			doc.setFont("helvetica", "bold"); doc.text("Inspection Status:", margin + 150, metaY);
			doc.setFont("helvetica", "normal"); doc.text(oData.InspectionStatus || "N/A", margin + 180, metaY);

			// ── SIGNATURE SECTION ────────────────────────────────────────────────
			var sigY = metaY + 16;
			var sigLineW = 52;
			var sigGap = (contentWidth - sigLineW * 4) / 3;
			var sigPositions = [margin, margin + sigLineW + sigGap, margin + (sigLineW + sigGap) * 2, margin + (sigLineW + sigGap) * 3];
			var sigLabels = ["Requested By", "HOD Approval", "Store In-Charge", "Security / Gate"];

			doc.setLineWidth(0.3);
			sigPositions.forEach(function (sx) {
				doc.line(sx, sigY, sx + sigLineW, sigY);
			});
			doc.setFont("helvetica", "bold"); doc.setFontSize(8);
			sigPositions.forEach(function (sx, i) {
				doc.text(sigLabels[i], sx + sigLineW / 2, sigY + 5, { align: "center" });
			});

			doc.save("GateEntry_" + (oData.GateEntryNo || oData.PCPNo || "Draft") + ".pdf");
			MessageToast.show("Gate Entry PDF generated.");
		},

		_numberToWords: function (num) {
			var a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
			var b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
			if ((num = num.toString()).length > 9) return "overflow";
			var n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
			if (!n) return "";
			var str = "";
			str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + "Crore " : "";
			str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + "Lakh " : "";
			str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + "Thousand " : "";
			str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + " " + a[n[4][1]]) + "Hundred " : "";
			str += (n[5] != 0) ? ((str !== "") ? "and " : "") + (a[Number(n[5])] || b[n[5][0]] + " " + a[n[5][1]]) : "";
			return str;
		},

		_getImageBase64: function (url) {
			return new Promise(function (resolve, reject) {
				var img = new Image();
				img.crossOrigin = "Anonymous";
				img.onload = function () {
					var canvas = document.createElement("canvas");
					canvas.width = img.width;
					canvas.height = img.height;
					canvas.getContext("2d").drawImage(img, 0, 0);
					resolve(canvas.toDataURL("image/png"));
				};
				img.onerror = reject;
				img.src = url;
			});
		}
	});
});
