sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, MessageBox, MessageToast, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("zaudgpms.audhatham.com.controller.GatePassCreation", {
		
		onInit: function () {
			this._pPOValueHelp = null;
			this._pMaterialValueHelp = null;
			this._pCustomerValueHelp = null;
			this._pInvoiceValueHelp = null;
			this._oInputSource = null;
			this._oRowContext = null;

			this._resetModel();

			var oODataModel = this.getOwnerComponent().getModel();
			if (oODataModel) {
				oODataModel.metadataLoaded().then(function () {
					this._loadPlants();
				}.bind(this)).catch(function () {
					MessageToast.show("Metadata unavailable — you can type Plant code manually.");
				});
			} else {
				this._loadPlants();
			}

			this.getRouter().getRoute("GatePassCreation").attachPatternMatched(this._onRouteMatched, this);
			this.getRouter().getRoute("GatePassDetail").attachPatternMatched(this._onDetailRouteMatched, this);
		},

		_onRouteMatched: function (oEvent) {
			this._resetModel();
			var oModel = this.getView().getModel("gp");
			oModel.setProperty("/editable", true);

			// Pre-fill Plant, Company Code and Department from logged-in user profile
			var oUserModel = sap.ui.getCore().getModel("user");
			if (oUserModel) {
				var sPlant = oUserModel.getProperty("/Plant");
				var sCocode = oUserModel.getProperty("/Cocode");
				if (sCocode) { oModel.setProperty("/Cocode", sCocode); }
				if (sPlant) {
					oModel.setProperty("/Plant", sPlant);
					this._loadVendors(sPlant);
					this._loadMaterials(sPlant);
				}
			}
		},

		_onDetailRouteMatched: function (oEvent) {
			var sReqNo = oEvent.getParameter("arguments").reqNo;
			this._resetModel();
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/editable", false);

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) return;

			sap.ui.core.BusyIndicator.show(0);
			var that = this;

			oODataModel.read("/ZRgpNrgpSet", {
				filters: [
					new Filter("GatePassNo", FilterOperator.EQ, sReqNo)
				],
				urlParameters: {
					"$expand": "ZRGPNRGPItmNav"
				},
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					console.log("[Detail Route Matched] raw oData results:", JSON.stringify(oData && oData.results || []));
					var oResult = oData && oData.results && oData.results[0];
					if (oResult) {
						that._populateModelWithData(oResult);
					} else {
						MessageBox.error("Gate Pass details not found.");
					}
				},
				error: function () {
					sap.ui.core.BusyIndicator.hide();
					MessageBox.error("Error retrieving Gate Pass details.");
				}
			});
		},

		_populateModelWithData: function (oData) {
			var oGpModel = this.getView().getModel("gp");
			
			oGpModel.setProperty("/GatePassReqNo", oData.GatePassReqNo || "");
			oGpModel.setProperty("/GatePassNo", oData.GatePassNo || "");
			oGpModel.setProperty("/Status", oData.Status || "Pending");
			oGpModel.setProperty("/Plant", oData.Plant || "");
			oGpModel.setProperty("/Cocode", oData.Cocode || "");
			
			if (oData.GpDate) {
				if (oData.GpDate instanceof Date) {
					oGpModel.setProperty("/gpDate", oData.GpDate);
				} else if (typeof oData.GpDate === "string" && oData.GpDate.length >= 8) {
					var y = oData.GpDate.substring(0, 4);
					var m = oData.GpDate.substring(4, 6);
					var d = oData.GpDate.substring(6, 8);
					oGpModel.setProperty("/gpDate", new Date(y, parseInt(m, 10) - 1, parseInt(d, 10)));
				}
			}

			oGpModel.setProperty("/Remarks", oData.Remarks || "");
			oGpModel.setProperty("/vendor", oData.Vendor || "");
			oGpModel.setProperty("/vendorName", oData.VendorName || "");
			oGpModel.setProperty("/vendorGST", oData.VendorGST || "");

			// Ensure loaded vendor is in the vendors list so the ComboBox selectedKey resolves visually
			var oVendorModel = this.getView().getModel("vendors");
			if (!oVendorModel) {
				oVendorModel = new JSONModel({ results: [] });
				this.getView().setModel(oVendorModel, "vendors");
			}
			if (oData.Vendor) {
				var aVendors = oVendorModel.getProperty("/results") || [];
				var bExists = aVendors.some(function (v) { return v.Vendor === oData.Vendor; });
				if (!bExists) {
					aVendors = aVendors.concat([{ Vendor: oData.Vendor, VendorName: oData.VendorName || "" }]);
					oVendorModel.setProperty("/results", aVendors);
				}
			}
			oGpModel.setProperty("/PurchaseOrder", oData.PurchaseOrder || "");
			oGpModel.setProperty("/CustomerInvoice", oData.CustomerInvoice || "");
			oGpModel.setProperty("/HasPONumber", !!(oData.PurchaseOrder));
			oGpModel.setProperty("/HasCustomerInvoice", !!(oData.CustomerInvoice));
			oGpModel.setProperty("/VehicleNo", oData.VehicleNo || "");
			oGpModel.setProperty("/DriverName", oData.DriverName || "");
			oGpModel.setProperty("/ModeOfDispatch", oData.ModeOfDispatch || "Road");

			// Determine index + boolean properties
			var sType = oData.GatePassType || oData.Type || "NRGP";
			var bRGP = sType === "RGP";
			oGpModel.setProperty("/TypeIndex", bRGP ? 0 : 1);
			oGpModel.setProperty("/IsReturnable", bRGP);
			oGpModel.setProperty("/IsNonReturnable", !bRGP);

			var bInward = oData.Direction === "Inward";
			oGpModel.setProperty("/DirectionIndex", bInward ? 0 : 1);
			oGpModel.setProperty("/IsInward", bInward);
			oGpModel.setProperty("/IsOutward", !bInward);

			var bManual = oData.EntryMode === "Manual";
			oGpModel.setProperty("/EntryModeIndex", bManual ? 1 : 0);
			oGpModel.setProperty("/IsManual", bManual);

			// Categorizations
			oGpModel.setProperty("/InwardCategory", oData.InwardCategory || "01-Purchase order");
			oGpModel.setProperty("/OutwardCategory", oData.OutwardCategory || "01-Service maintenance");

			// Fetch items
			var aItems = [];
			var results = (oData.GateReqItmNav && oData.GateReqItmNav.results) || (oData.GateReqItemNav && oData.GateReqItemNav.results) || (oData.ZRGPNRGPItmNav && oData.ZRGPNRGPItmNav.results) || [];
			results.forEach(function (it, idx) {
				var sExpDateStr = it.ExpectedReturnableDate || it.ReturnableDate;
				var dExpected = null;
				if (sExpDateStr && sExpDateStr !== "00000000") {
					var y = sExpDateStr.substring(0, 4);
					var m = sExpDateStr.substring(4, 6);
					var d = sExpDateStr.substring(6, 8);
					dExpected = new Date(y, parseInt(m, 10) - 1, parseInt(d, 10));
				}
				
				var dRet = null;
				if (it.ReturnDate && it.ReturnDate !== "00000000") {
					var y = it.ReturnDate.substring(0, 4);
					var m = it.ReturnDate.substring(4, 6);
					var d = it.ReturnDate.substring(6, 8);
					dRet = new Date(y, parseInt(m, 10) - 1, parseInt(d, 10));
				}

				// Quantity can be RequestedQuantity or Quantity or RecievedQuantity
				var sQtyVal = it.RequestedQuantity || it.Quantity;
				// If RGP was loaded, the quantity sent out was in RecievedQuantity!
				if (sType === "RGP" && it.RecievedQuantity && it.RecievedQuantity !== "0.000" && it.RecievedQuantity !== " ") {
					sQtyVal = it.RecievedQuantity;
				}

				aItems.push({
					sno: String(idx + 1).padStart(2, '0'),
					material: it.Material || "",
					materialName: it.MaterialDesc || it.ItemDescription || "",
					quantity: String(sQtyVal || ""),
					noOfPacks: it.NoOfPackages ? String(it.NoOfPackages) : "",
					uom: it.UOM || "",
					expectedReturnableDate: dExpected,
					receivedQty: parseFloat(it.ReceivedQuantity || it.RecievedQuantity || 0),
					returnDate: dRet,
					rate: parseFloat(it.ItemNetPrice || it.rate || 0),
					amount: parseFloat(it.Totalvalue || it.amount || 0).toFixed(2)
				});
			});
			oGpModel.setProperty("/items", aItems);

			if (oData.Plant && oGpModel.getProperty("/editable")) {
				this._loadVendors(oData.Plant);
				this._loadMaterials(oData.Plant);
			}
		},

		_resetModel: function () {
			var oViewModel = new JSONModel({
				GatePassReqNo: "",
				GatePassNo: "",
				Status: "Draft",
				Plant: "",
				Cocode: "",
				gpDate: new Date(),
				Remarks: "",
				vendor: "",
				vendorName: "",
				vendorAddress: "",
				vendorGST: "",
				PurchaseOrder: "",
				CustomerInvoice: "",
				CustomerNo: "",
				CustomerName: "",
				ModeOfDispatch: "Road",
				VehicleNo: "",
				DriverName: "",

				// Checkbox booleans (drive UI visibility)
				IsInward: false,
				IsOutward: true,
				IsReturnable: true,
				IsNonReturnable: false,
				IsManual: false,
				HasPONumber: false,
				HasCustomerInvoice: false,

				// Index mirrors kept for OData payload compatibility
				DirectionIndex: 1,
				TypeIndex: 0,
				EntryModeIndex: 0,

				InwardCategory: "01-Purchase order",
				OutwardCategory: "01-Service maintenance",

				items: [
					this._newItem(1)
				],
				editable: true
			});
			this.getView().setModel(oViewModel, "gp");
		},

		_newItem: function (iSno) {
			return {
				sno: String(iSno).padStart(2, '0'),
				material: "",
				materialName: "",
				quantity: "",
				noOfPacks: "",
				uom: "",
				expectedReturnableDate: null,
				receivedQty: "",
				returnDate: null,
				rate: 0,
				amount: "0.00"
			};
		},

		onInwardChange: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/IsInward", bSelected);
			if (bSelected) {
				oGpModel.setProperty("/IsOutward", false);
				oGpModel.setProperty("/DirectionIndex", 0);
			}
		},

		onOutwardChange: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/IsOutward", bSelected);
			if (bSelected) {
				oGpModel.setProperty("/IsInward", false);
				oGpModel.setProperty("/DirectionIndex", 1);
			}
		},

		onReturnableChange: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/IsReturnable", bSelected);
			if (bSelected) {
				oGpModel.setProperty("/IsNonReturnable", false);
				oGpModel.setProperty("/TypeIndex", 0);
			}
		},

		onNonReturnableChange: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/IsNonReturnable", bSelected);
			if (bSelected) {
				oGpModel.setProperty("/IsReturnable", false);
				oGpModel.setProperty("/TypeIndex", 1);
			}
		},

		onManualChange: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/IsManual", bSelected);
			oGpModel.setProperty("/EntryModeIndex", bSelected ? 1 : 0);
			if (bSelected) {
				oGpModel.setProperty("/PurchaseOrder", "");
				oGpModel.setProperty("/HasPONumber", false);
				var aItems = oGpModel.getProperty("/items") || [];
				aItems.forEach(function (item) {
					item.material = "";
					item.materialName = "";
					item.uom = "";
				});
				oGpModel.setProperty("/items", aItems);
			}
		},

		onPONumberCheckBoxSelect: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/HasPONumber", bSelected);
			if (bSelected) {
				oGpModel.setProperty("/HasCustomerInvoice", false);
				oGpModel.setProperty("/CustomerInvoice", "");
			} else {
				oGpModel.setProperty("/PurchaseOrder", "");
			}
		},

		onCustomerInvoiceNoCheckBoxSelect: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/HasCustomerInvoice", bSelected);
			if (bSelected) {
				oGpModel.setProperty("/HasPONumber", false);
				oGpModel.setProperty("/PurchaseOrder", "");
				oGpModel.setProperty("/vendor", "");
				oGpModel.setProperty("/vendorName", "");
			} else {
				oGpModel.setProperty("/CustomerInvoice", "");
				oGpModel.setProperty("/CustomerNo", "");
				oGpModel.setProperty("/CustomerName", "");
			}
		},

		onGatePassNoChange: function (oEvent) {
			var sGpNo = oEvent.getParameter("value") || oEvent.getSource().getValue();
			sGpNo = (sGpNo || "").trim();
			if (!sGpNo) { return; }

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			sap.ui.core.BusyIndicator.show(0);
			var that = this;

			oODataModel.read("/ZRgpNrgpSet", {
				filters: [
					new Filter("GatePassNo", FilterOperator.EQ, sGpNo)
				],
				urlParameters: {
					"$expand": "ZRGPNRGPItmNav"
				},
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					console.log("[GatePassNo Change] raw oData results:", JSON.stringify(oData && oData.results || []));
					var oResult = oData && oData.results && oData.results[0];
					if (oResult) {
						var bEditable = that.getView().getModel("gp").getProperty("/editable");
						var oGpModel = that.getView().getModel("gp");
						var bCreateInwardRGP = bEditable && oGpModel.getProperty("/IsInward") && oGpModel.getProperty("/IsReturnable");

						that._populateModelWithData(oResult);
						
						oGpModel.setProperty("/editable", bEditable);
						oGpModel.setProperty("/GatePassNo", sGpNo);

						if (bCreateInwardRGP) {
							// Override Direction and Type to remain Inward RGP (since we are creating an Inward return of an Outward RGP)
							oGpModel.setProperty("/DirectionIndex", 0);
							oGpModel.setProperty("/IsInward", true);
							oGpModel.setProperty("/IsOutward", false);

							oGpModel.setProperty("/TypeIndex", 0);
							oGpModel.setProperty("/IsReturnable", true);
							oGpModel.setProperty("/IsNonReturnable", false);

							// Keep the referenced Outward Gate Pass Number on the model
							oGpModel.setProperty("/GatePassNo", sGpNo);
						}
						
						MessageToast.show("Gate Pass details loaded.");
					} else {
						MessageBox.error("Gate Pass Number not found.");
					}
				},
				error: function (oErr) {
					sap.ui.core.BusyIndicator.hide();
					var sMsg = "";
					try {
						var oResp = JSON.parse(oErr.responseText);
						sMsg = oResp.error.message.value;
					} catch (e) {
						sMsg = oErr.message || oErr.statusText || "Unknown error";
					}
					MessageBox.error("Failed to load details: " + sMsg);
				}
			});
		},

		onNavBackToList: function () {
			this.getRouter().navTo("home");
		},

		onPOValueHelp: function (oEvent) {
			var oGpModel = this.getView().getModel("gp");
			var sPlant = oGpModel.getProperty("/Plant");

			if (!sPlant) {
				MessageToast.show("Please select a Plant Code first.");
				return;
			}

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) {
				MessageToast.show("Backend OData service not connected.");
				return;
			}

			var oPOModel = this.getView().getModel("pos");
			if (!oPOModel) {
				oPOModel = new JSONModel({ results: [] });
				this.getView().setModel(oPOModel, "pos");
			}

			sap.ui.core.BusyIndicator.show(0);

			var sFilter = sPlant ? "Plant eq '" + sPlant + "'" : "";
			var oUrlParams = { "$expand": "GateInPoNav", "$top": "500" };
			if (sFilter) { oUrlParams["$filter"] = sFilter; }

			var that = this;
			oODataModel.read("/GateInPoHdrSet", {
				urlParameters: oUrlParams,
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					var aResults = (oData && oData.results) || [];
					oPOModel.setProperty("/results", aResults);

					if (!that._pPOValueHelp) {
						sap.ui.core.Fragment.load({
							id: that.getView().getId(),
							name: "zaudgpms.audhatham.com.view.fragments.POValueHelp",
							controller: that
						}).then(function (oDialog) {
							that._pPOValueHelp = oDialog;
							that.getView().addDependent(that._pPOValueHelp);
							that._pPOValueHelp.open();
						});
					} else {
						that._pPOValueHelp.open();
					}
				},
				error: function (oErr) {
					sap.ui.core.BusyIndicator.hide();
					var sMsg = "";
					try {
						var oResp = JSON.parse(oErr.responseText);
						sMsg = oResp.error.message.value;
					} catch (e) {
						sMsg = oErr.message || oErr.statusText || "Unknown error";
					}
					MessageToast.show("Failed to load POs: " + sMsg);
				}
			});
		},

		onPOValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter({
				filters: [
					new Filter("PurchaseOrder", FilterOperator.Contains, sValue),
					new Filter("VendorDesc", FilterOperator.Contains, sValue)
				],
				and: false
			});
			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onPOValueHelpConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (!oSelectedItem) { return; }

			var oPO = oSelectedItem.getBindingContext("pos").getObject();
			var oGpModel = this.getView().getModel("gp");

			oGpModel.setProperty("/PurchaseOrder", oPO.PurchaseOrder || "");
			oGpModel.setProperty("/vendor", oPO.Vendor || "");
			oGpModel.setProperty("/vendorName", oPO.VendorDesc || "");

			// Ensure PO's vendor is in the vendors list so the ComboBox selectedKey resolves visually
			if (oPO.Vendor) {
				var oVendorModel = this.getView().getModel("vendors");
				var aVendors = (oVendorModel && oVendorModel.getProperty("/results")) || [];
				var bExists = aVendors.some(function (v) { return v.Vendor === oPO.Vendor; });
				if (!bExists) {
					aVendors = aVendors.concat([{ Vendor: oPO.Vendor, VendorName: oPO.VendorDesc || "" }]);
					oVendorModel.setProperty("/results", aVendors);
				}
			}

			var aItems = [];
			var aLines = (oPO.GateInPoNav && oPO.GateInPoNav.results) || [];
			if (aLines.length > 0) {
				console.log("[PO Value Help Confirm] First PO item data structure:", JSON.stringify(aLines[0], null, 2));
			}
			aLines.forEach(function (it, idx) {
				aItems.push({
					sno: String(idx + 1).padStart(2, '0'),
					material: it.Material || it.Item,
					materialName: it.MaterialDesc || it.ItemDescription || it.MaterialName || it.Description || it.ShortText || "",
					quantity: parseFloat(it.POQuantity || ""),
					noOfPacks: "",
					uom: it.UOM || "",
					expectedReturnableDate: null,
					receivedQty: parseFloat(it.RecievedQuantity || ""),
					returnDate: null,
					rate: 0,
					amount: "0.00"
				});
			});
			if (aItems.length > 0) {
				oGpModel.setProperty("/items", aItems);
			}
		},

		onPOValueHelpCancel: function () {},

		onPurchaseOrderInputSubmit: function (oEvent) {
			this._fetchPOByNumber((oEvent.getParameter("value") || oEvent.getSource().getValue() || "").trim());
		},

		onPurchaseOrderInputChange: function (oEvent) {
			this._fetchPOByNumber((oEvent.getParameter("value") || "").trim());
		},

		_fetchPOByNumber: function (sPO) {
			if (!sPO) { return; }

			var oGpModel = this.getView().getModel("gp");
			var sPlant = oGpModel.getProperty("/Plant");
			if (!sPlant) {
				MessageToast.show("Please select a Plant Code first.");
				return;
			}

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			sap.ui.core.BusyIndicator.show(0);
			var that = this;
			oODataModel.read("/GateInPoHdrSet", {
				urlParameters: {
					"$filter": "PurchaseOrder eq '" + sPO + "' and Plant eq '" + sPlant + "'",
					"$expand": "GateInPoNav",
					"$top": "1"
				},
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					var oPO = oData && oData.results && oData.results[0];
					if (!oPO) {
						MessageBox.error("PO Number '" + sPO + "' not found. Please check and try again.");
					oGpModel.setProperty("/PurchaseOrder", "");
						return;
					}
					oGpModel.setProperty("/PurchaseOrder", oPO.PurchaseOrder || sPO);
					oGpModel.setProperty("/vendor", oPO.Vendor || "");
					oGpModel.setProperty("/vendorName", oPO.VendorDesc || "");

					if (oPO.Vendor) {
						var oVendorModel = that.getView().getModel("vendors");
						var aVendors = (oVendorModel && oVendorModel.getProperty("/results")) || [];
						if (!aVendors.some(function (v) { return v.Vendor === oPO.Vendor; })) {
							aVendors = aVendors.concat([{ Vendor: oPO.Vendor, VendorName: oPO.VendorDesc || "" }]);
							oVendorModel.setProperty("/results", aVendors);
						}
					}

					var aLines = (oPO.GateInPoNav && oPO.GateInPoNav.results) || [];
					if (aLines.length > 0) {
						var aItems = aLines.map(function (it, idx) {
							return {
								sno: String(idx + 1).padStart(2, '0'),
								material: it.Material || it.Item || "",
								materialName: it.MaterialDesc || it.ShortText || it.ItemDescription || "",
								quantity: parseFloat(it.POQuantity || "") || "",
								noOfPacks: "",
								uom: it.UOM || "",
								expectedReturnableDate: null,
								receivedQty: parseFloat(it.RecievedQuantity || "") || "",
								returnDate: null,
								rate: 0,
								amount: "0.00"
							};
						});
						oGpModel.setProperty("/items", aItems);
					}
					MessageToast.show("PO details loaded.");
				},
				error: function (oErr) {
					sap.ui.core.BusyIndicator.hide();
					var sMsg = "";
					try { sMsg = JSON.parse(oErr.responseText).error.message.value; } catch (e) { sMsg = oErr.message || "Error"; }
					MessageToast.show("Failed to fetch PO: " + sMsg);
				}
			});
		},

		onCustomerInputSubmit: function (oEvent) {
			this._fetchCustomerByNo((oEvent.getParameter("value") || oEvent.getSource().getValue() || "").trim());
		},

		onCustomerInputChange: function (oEvent) {
			this._fetchCustomerByNo((oEvent.getParameter("value") || "").trim());
		},

		onCustomerInvoiceInputSubmit: function (oEvent) {
			this._fetchCustomerByNo((oEvent.getParameter("value") || oEvent.getSource().getValue() || "").trim());
		},

		onCustomerInvoiceInputChange: function (oEvent) {
			this._fetchCustomerByNo((oEvent.getParameter("value") || "").trim());
		},

		_fetchCustomerByNo: function (sCustomerNo) {
			if (!sCustomerNo) { return; }

			var oGpModel = this.getView().getModel("gp");

			var sPlant = oGpModel.getProperty("/Plant");
			if (!sPlant) {
				MessageToast.show("Please select a Plant Code first.");
				return;
			}

			var that = this;

			var fnSearch = function () {
				var oCustomerModel = that.getView().getModel("customers");
				var aCustomers = (oCustomerModel && oCustomerModel.getProperty("/results")) || [];
				var oFound = aCustomers.find(function (c) {
					return (c.CustomerNo || "").toUpperCase() === sCustomerNo.toUpperCase();
				});
				if (oFound) {
					oGpModel.setProperty("/CustomerNo", oFound.CustomerNo);
					oGpModel.setProperty("/CustomerName", oFound.CustomerName);
				} else {
					MessageBox.error("Customer Number '" + sCustomerNo + "' not found. Please check and try again.");
					oGpModel.setProperty("/CustomerNo", "");
				}
			};

			// If customers already loaded, search immediately
			var oCustomerModel = this.getView().getModel("customers");
			var aCustomers = (oCustomerModel && oCustomerModel.getProperty("/results")) || [];
			if (aCustomers.length > 0) {
				fnSearch();
				return;
			}

			// Load all customers for plant first, then search
			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			if (!oCustomerModel) {
				oCustomerModel = new JSONModel({ results: [] });
				this.getView().setModel(oCustomerModel, "customers");
			}

			sap.ui.core.BusyIndicator.show(0);
			oODataModel.read("/ZCUSTOMERSet", {
				urlParameters: { "$filter": "Plant eq '" + sPlant + "'", "$top": "500" },
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					var aNormalized = (oData.results || []).map(function (c) {
						return { CustomerNo: c.Customer || "", CustomerName: c.Name || "", City: c.City || "" };
					});
					oCustomerModel.setProperty("/results", aNormalized);
					fnSearch();
				},
				error: function (oErr) {
					sap.ui.core.BusyIndicator.hide();
					var sMsg = "";
					try { sMsg = JSON.parse(oErr.responseText).error.message.value; } catch (e) { sMsg = oErr.message || "Error"; }
					MessageToast.show("Failed to load customers: " + sMsg);
				}
			});
		},

		onCustomerInvoiceValueHelp: function () {
			var oGpModel = this.getView().getModel("gp");
			var sPlant = oGpModel.getProperty("/Plant");

			if (!sPlant) {
				MessageToast.show("Please select a Plant Code first.");
				return;
			}

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) {
				MessageToast.show("Backend OData service not connected.");
				return;
			}

			this._loadCustomers(sPlant);

			var that = this;
			if (!this._pCustomerValueHelp) {
				this._pCustomerValueHelp = sap.ui.core.Fragment.load({
					id: that.getView().getId(),
					name: "zaudgpms.audhatham.com.view.fragments.CustomerValueHelp",
					controller: that
				}).then(function (oDialog) {
					that.getView().addDependent(oDialog);
					return oDialog;
				});
			}

			this._pCustomerValueHelp.then(function (oDialog) {
				oDialog.getBinding("items").filter([]);
				oDialog.open();
			});
		},

		onCustomerValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter({
				filters: [
					new Filter("CustomerNo", FilterOperator.Contains, sValue),
					new Filter("CustomerName", FilterOperator.Contains, sValue)  // normalized field
				],
				and: false
			});
			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onCustomerValueHelpConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (!oSelectedItem) { return; }

			var oCustomer = oSelectedItem.getBindingContext("customers").getObject();
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/CustomerNo", oCustomer.CustomerNo || "");
			oGpModel.setProperty("/CustomerName", oCustomer.CustomerName || "");
		},

		onCustomerValueHelpCancel: function () {},

		// ── Invoice (VBELN) Value Help ────────────────────────────────────
		onInvoiceValueHelp: function () {
			var oGpModel = this.getView().getModel("gp");
			var sPlant = oGpModel.getProperty("/Plant");

			if (!sPlant) {
				MessageToast.show("Please select a Plant Code first.");
				return;
			}

			var that = this;
			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			var oInvoiceModel = this.getView().getModel("invoices");
			if (!oInvoiceModel) {
				oInvoiceModel = new JSONModel({ results: [] });
				this.getView().setModel(oInvoiceModel, "invoices");
			}

			sap.ui.core.BusyIndicator.show(0);

			var aCandidates = [
				"/Zcust_InvoiceSet",
				"/ZcustInvoiceSet",
				"/ZCUST_INVOICESet",
				"/Zcust_invoiceSet",
				"/Zcust_"
			];

			var fnTryLoad = function (index) {
				if (index >= aCandidates.length) {
					sap.ui.core.BusyIndicator.hide();
					MessageToast.show("Failed to load invoices (no matching EntitySet found).");
					return;
				}

				var sEntitySet = aCandidates[index];
				console.log("[Invoice] Attempting to read from EntitySet:", sEntitySet);

				oODataModel.read(sEntitySet, {
					urlParameters: { "$filter": "Plant eq '" + sPlant + "'" },
					success: function (oData) {
						sap.ui.core.BusyIndicator.hide();
						console.log("[Invoice] Successfully loaded from:", sEntitySet);
						var aResults = (oData.results || []).map(function (r) {
							return { VBELN: r.VBELN || "" };
						});
						oInvoiceModel.setProperty("/results", aResults);

						if (!that._pInvoiceValueHelp) {
							that._pInvoiceValueHelp = sap.ui.core.Fragment.load({
								id: that.getView().getId(),
								name: "zaudgpms.audhatham.com.view.fragments.InvoiceValueHelp",
								controller: that
							}).then(function (oDialog) {
								that.getView().addDependent(oDialog);
								return oDialog;
							});
						}
						that._pInvoiceValueHelp.then(function (oDialog) {
							oDialog.getBinding("items").filter([]);
							oDialog.open();
						});
					},
					error: function (oErr) {
						console.warn("[Invoice] Failed to read from:", sEntitySet, "Error:", oErr && oErr.responseText);
						fnTryLoad(index + 1);
					}
				});
			};

			fnTryLoad(0);
		},

		onInvoiceValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter("VBELN", FilterOperator.Contains, sValue);
			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onInvoiceValueHelpConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (!oSelectedItem) { return; }

			var oInvoice = oSelectedItem.getBindingContext("invoices").getObject();
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/CustomerInvoice", oInvoice.VBELN || "");
		},

		onInvoiceValueHelpCancel: function () {},

		_loadCustomers: function (sPlant) {
			var oCustomerModel = this.getView().getModel("customers");
			if (!oCustomerModel) {
				oCustomerModel = new JSONModel({ results: [] });
				this.getView().setModel(oCustomerModel, "customers");
			}

			if (!sPlant) {
				oCustomerModel.setProperty("/results", []);
				return;
			}

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			var oCustUrlParams = { "$top": "500" };
			oCustUrlParams["$filter"] = "Plant eq '" + sPlant + "'";

			sap.ui.core.BusyIndicator.show(0);
			oODataModel.read("/ZCUSTOMERSet", {
				urlParameters: oCustUrlParams,
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					var aNormalized = (oData.results || []).map(function (c) {
						return {
							CustomerNo:   c.Customer || "",
							CustomerName: c.Name     || "",
							City:         c.City     || ""
						};
					});
					oCustomerModel.setProperty("/results", aNormalized);
				},
				error: function () {
					sap.ui.core.BusyIndicator.hide();
					MessageToast.show("Failed to load customers.");
				}
			});
		},

		_loadPlants: function () {
			var oPlantModel = new JSONModel({ results: [] });
			this.getView().setModel(oPlantModel, "plants");

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			sap.ui.core.BusyIndicator.show(0);
			oODataModel.read("/ZPlantSet", {
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					var aResults = oData.results || [];
					if (aResults.length === 0) { return; }
					var aNormalized = aResults.map(function (p) {
						return {
							Plant: p.Plant || "",
							PlantName: p.PlantName || p.Name1 || "",
							CoCode: p.CoCode || ""
						};
					});
					oPlantModel.setProperty("/results", aNormalized);
				},
				error: function () {
					sap.ui.core.BusyIndicator.hide();
					MessageToast.show("Plant list unavailable.");
				}
			});
		},

		_loadMaterials: function (sPlant) {
			var oMaterialsModel = this.getView().getModel("materials");
			if (!oMaterialsModel) {
				oMaterialsModel = new JSONModel({ results: [] });
				this.getView().setModel(oMaterialsModel, "materials");
			}

			if (!sPlant) {
				oMaterialsModel.setProperty("/results", []);
				return;
			}

			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) { return; }

			var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

			oODataModel.read("/ZMaterialSet", {
				filters: aFilters,
				success: function (oData) {
					var aResults = oData.results || [];
					var aNormalized = aResults.map(function (m) {
						return {
							Material: m.Material || "",
							MaterialName: m.MaterialDesc || m.MaterialName || m.Description || "",
							UOM: m.UOM || "",
							UnitPrice: parseFloat(m.UnitPrice || 0),
							HsnDesc: m.HSNDesc || ""
						};
					});
					oMaterialsModel.setProperty("/results", aNormalized);
				},
				error: function () {
					MessageToast.show("Failed to load materials.");
				}
			});
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
					if (aResults.length > 0) {
						console.log("[ZVendorSet] sample record keys:", Object.keys(aResults[0]));
					}
					var aNormalized = aResults.map(function (v) {
						return {
							Vendor: v.Vendor || v.VendorCode || "",
							VendorName: v.VendorName || v.Name1 || v.NAME1 || v.VendorDesc || v.Name || "",
							Street: v.Street || v.Street1 || "",
							City: v.City || "",
							PostalCode: v.PostalCode || v.ZipCode || "",
							Country: v.Country || "",
							VendorGST: v.VendorGST || v.GSTNumber || ""
						};
					});
					oVendorModel.setProperty("/results", aNormalized);
				},
				error: function () {
					MessageToast.show("Failed to load vendors.");
				}
			});
		},

		onPlantChange: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (!oSelectedItem) { return; }

			var sKey = oSelectedItem.getKey();
			this._applyPlant(sKey);
		},

		onComboBoxPlantChange: function (oEvent) {
			if (oEvent.getSource().getSelectedItem()) { return; }
			var sValue = (oEvent.getParameter("value") || "").trim().toUpperCase();
			if (!sValue) { return; }
			this._applyPlant(sValue);
		},

		_applyPlant: function (sKey) {
			var oGpModel = this.getView().getModel("gp");
			oGpModel.setProperty("/Plant", sKey);

			var oPlantModel = this.getView().getModel("plants");
			var aPlants = (oPlantModel && oPlantModel.getProperty("/results")) || [];
			var oPlant = aPlants.find(function (p) { return p.Plant === sKey; });
			if (oPlant && oPlant.CoCode) {
				oGpModel.setProperty("/Cocode", oPlant.CoCode);
			}

			var aItems = oGpModel.getProperty("/items") || [];
			aItems.forEach(function (item) {
				item.material = "";
				item.materialName = "";
				item.uom = "";
				item.rate = 0;
				item.amount = "0.00";
			});
			oGpModel.setProperty("/items", aItems);

			this._loadVendors(sKey);
			this._loadMaterials(sKey);
		},

		onVendorSelect: function (oEvent) {
			var oItem = oEvent.getParameter("selectedItem");
			if (!oItem) { return; }

			var sKey = oItem.getKey();
			var aVendors = this.getView().getModel("vendors").getProperty("/results") || [];
			var oVendor = aVendors.find(function (v) { return v.Vendor === sKey; });
			if (!oVendor) { return; }

			var oGp = this.getView().getModel("gp");
			oGp.setProperty("/vendorName", oVendor.VendorName);
			oGp.setProperty("/vendorGST", oVendor.VendorGST);
		},

		onMaterialValueHelp: function (oEvent) {
			this._oInputSource = oEvent.getSource();
			this._oRowContext = this._oInputSource.getBindingContext("gp");
			var sPlant = this.getView().getModel("gp").getProperty("/Plant");

			if (!sPlant) {
				MessageToast.show("Please select Plant first.");
				return;
			}

			if (!this._pMaterialValueHelp) {
				this._pMaterialValueHelp = sap.ui.core.Fragment.load({
					id: this.getView().getId(),
					name: "zaudgpms.audhatham.com.view.fragments.MaterialValueHelp",
					controller: this
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					return oDialog;
				}.bind(this));
			}

			this._pMaterialValueHelp.then(function (oDialog) {
				oDialog.getBinding("items").filter([]);
				oDialog.open();
			});
		},

		onMaterialValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter({
				filters: [
					new Filter("Material", FilterOperator.Contains, sValue),
					new Filter("MaterialName", FilterOperator.Contains, sValue)
				],
				and: false
			});
			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onMaterialValueHelpConfirm: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			if (!oSelectedItem) { return; }

			var oSelectedMaterial = oSelectedItem.getBindingContext("materials").getObject();
			var oModel = this.getView().getModel("gp");
			var sPath = this._oRowContext.getPath();

			oModel.setProperty(sPath + "/material", oSelectedMaterial.Material);
			oModel.setProperty(sPath + "/materialName", oSelectedMaterial.MaterialName);
			oModel.setProperty(sPath + "/uom", oSelectedMaterial.UOM);
			oModel.setProperty(sPath + "/rate", oSelectedMaterial.UnitPrice);

			var fQty = parseFloat(oModel.getProperty(sPath + "/quantity")) || "";
			var fRate = parseFloat(oSelectedMaterial.UnitPrice) || 0;
			oModel.setProperty(sPath + "/amount", (fQty * fRate).toFixed(2));
		},

		onMaterialInputChange: function (oEvent) {
			var oSource = oEvent.getSource();
			var sCode = (oEvent.getParameter("value") || "").trim().toUpperCase();
			var oContext = oSource.getBindingContext("gp");
			var oModel = this.getView().getModel("gp");
			var sPath = oContext.getPath();

			if (!sCode) {
				oModel.setProperty(sPath + "/materialName", "");
				oModel.setProperty(sPath + "/uom", "");
				oModel.setProperty(sPath + "/rate", 0);
				oModel.setProperty(sPath + "/amount", "0.00");
				return;
			}

			// Look up in already-loaded materials model first
			var oMaterialsModel = this.getView().getModel("materials");
			var aMaterials = (oMaterialsModel && oMaterialsModel.getProperty("/results")) || [];
			var oFound = aMaterials.find(function (m) {
				return (m.Material || "").toUpperCase() === sCode;
			});

			if (oFound) {
				oModel.setProperty(sPath + "/material", oFound.Material);
				oModel.setProperty(sPath + "/materialName", oFound.MaterialName);
				oModel.setProperty(sPath + "/uom", oFound.UOM);
				oModel.setProperty(sPath + "/rate", oFound.UnitPrice);
				var fQty = parseFloat(oModel.getProperty(sPath + "/quantity")) || 0;
				oModel.setProperty(sPath + "/amount", (fQty * (oFound.UnitPrice || 0)).toFixed(2));
			} else {
				MessageToast.show("Material '" + sCode + "' not found in plant materials list.");
			}
		},

		onAddItem: function () {
			var oGp = this.getView().getModel("gp");
			var aItems = oGp.getProperty("/items") || [];
			aItems.push(this._newItem(aItems.length + 1));
			oGp.setProperty("/items", aItems);
		},

		onRemoveItem: function (oEvent) {
			var oItem = oEvent.getSource().getBindingContext("gp").getObject();
			var oGp = this.getView().getModel("gp");
			var aItems = oGp.getProperty("/items") || [];
			var iIndex = aItems.indexOf(oItem);
			if (iIndex > -1) {
				aItems.splice(iIndex, 1);
				aItems.forEach(function (it, i) {
					it.sno = String(i + 1).padStart(2, '0');
				});
				oGp.setProperty("/items", aItems);
			}
		},

		onQtyRateChange: function (oEvent) {
			var oSource = oEvent.getSource();
			var oContext = oSource.getBindingContext("gp");
			var oModel = this.getView().getModel("gp");

			var oItem = oContext.getObject();
			var fQty = parseFloat(oItem.quantity) || "";
			var fRate = parseFloat(oItem.rate) || 0;
			oModel.setProperty(oContext.getPath() + "/amount", (fQty * fRate).toFixed(2));
		},

		onSubmit: function () {
			try {
				var oGp = this.getView().getModel("gp").getData();

				if (!oGp.Plant) {
					MessageBox.error("Please select Plant Code first.");
					return;
				}

				if (!oGp.IsInward && !oGp.IsOutward) {
					MessageBox.error("Please select a Direction — Inward or Outward.");
					return;
				}

				if (!oGp.IsReturnable && !oGp.IsNonReturnable) {
					MessageBox.error("Please select a Gate Pass Type — Returnable (RGP) or Non-Returnable (NRGP).");
					return;
				}

				if (oGp.HasCustomerInvoice) {
					if (!oGp.CustomerNo) {
						MessageBox.error("Please select a Customer.");
						return;
					}
					if (!oGp.CustomerInvoice) {
						MessageBox.error("Please enter a Customer Invoice Number.");
						return;
					}
				} else {
					if (!oGp.vendor) {
						MessageBox.error("Please select a Supplier.");
						return;
					}
					if (oGp.HasPONumber && !oGp.PurchaseOrder) {
						MessageBox.error("Please enter a PO Number.");
						return;
					}
				}

				var sDirection = oGp.IsInward ? "Inward" : "Outward";
				var sType      = oGp.IsReturnable ? "RGP" : "NRGP";
				var sEntryMode = oGp.IsManual ? "Manual" : "System";

				var fnFormatDate = function (oDate) {
					if (!oDate) return "";
					var d = (oDate instanceof Date) ? oDate : new Date(oDate);
					if (isNaN(d.getTime())) return "";
					var y = d.getFullYear();
					var m = String(d.getMonth() + 1).padStart(2, '0');
					var day = String(d.getDate()).padStart(2, '0');
					return y + m + day;
				};

				var fnFormatDateISO = function (oDate) {
					if (!oDate) return "";
					var d = (oDate instanceof Date) ? oDate : new Date(oDate);
					if (isNaN(d.getTime())) return "";
					var y = d.getFullYear();
					var m = String(d.getMonth() + 1).padStart(2, '0');
					var day = String(d.getDate()).padStart(2, '0');
					return y + "-" + m + "-" + day;
				};

				var sDocumentRef = "";
				if (oGp.HasPONumber) {
					sDocumentRef = "PO";
				} else if (oGp.HasCustomerInvoice) {
					sDocumentRef = "Customer Invoice No";
				}

				var oPayload = {
					Direction:       sDirection,
					Type:            sType,
					EntryMode:       sEntryMode,
					DocumentRef:     sDocumentRef,
					Plant:           oGp.Plant,
					GpDate:          fnFormatDate(oGp.gpDate),
					GatePassNo:      oGp.GatePassNo || "",
					Remarks:         oGp.Remarks || "",
					Vendor:          oGp.vendor,
					VendorName:      oGp.vendorName || "",
					PurchaseOrder:   oGp.PurchaseOrder || "",
					VehicleNo:       oGp.VehicleNo || "",
					ModeOfDispatch:  (oGp.ModeOfDispatch || "ROAD").toUpperCase(),
					DriverName:      oGp.DriverName || "",
					InwardCategory:  oGp.IsInward  ? (oGp.InwardCategory  || "") : "",
					OutwardCategory: oGp.IsOutward ? (oGp.OutwardCategory || "") : "",
					CustomerInvoice: oGp.CustomerInvoice || "",
					Message:         "",

					ZRGPNRGPItmNav: {
						results: (oGp.items || []).map(function (it, index) {
							var sQty = "0.000";
							var sRecQty = "0.000";
							if (sDirection === "Inward" && sType === "RGP") {
								sRecQty = it.quantity ? parseFloat(it.quantity).toFixed(3) : "0.000";
								if (it.receivedQty !== undefined && it.receivedQty !== "" && it.receivedQty !== null) {
									sRecQty = parseFloat(it.receivedQty).toFixed(3);
								}
							} else {
								sQty = it.quantity ? parseFloat(it.quantity).toFixed(3) : "0.000";
								if (sType === "RGP" && it.receivedQty !== undefined && it.receivedQty !== "" && it.receivedQty !== null) {
									sRecQty = parseFloat(it.receivedQty).toFixed(3);
								}
							}

							return {
								Direction:        sDirection,
								Type:             sType,
								EntryMode:        sEntryMode,
								GatePassNo:       oGp.GatePassNo || "",
								ItemNo:           String((index + 1) * 10).padStart(5, '0'),
								Material:         it.material || "",
								ItemDescription:  it.materialName || "",
								UOM:              it.uom || "EA",
								RecievedQuantity: sRecQty,
								Quantity:         sQty,
								NoOfPackages:     it.noOfPacks ? String(it.noOfPacks) : "",
								ReturnableDate:   fnFormatDate(it.expectedReturnableDate)
							};
						})
					}
				};

				var oODataModel = this.getOwnerComponent().getModel();
				if (!oODataModel) {
					MessageBox.error("Backend OData service not connected.");
					return;
				}

				sap.ui.core.BusyIndicator.show(0);
				var that = this;

				oODataModel.create("/ZRgpNrgpSet", oPayload, {
					success: function (oData) {
						sap.ui.core.BusyIndicator.hide();
						var sMsg = oData.Message;
						MessageBox.success(sMsg, {
							onClose: function () {
								that.onNavBackToList();
							}
						});
					},
					error: function (oError) {
						sap.ui.core.BusyIndicator.hide();
						var sErrorMsg = "Failed to create Gate Pass.";
						try {
							var oResp = JSON.parse(oError.responseText);
							var oErr = oResp.error;
							sErrorMsg = oErr.message.value;
							// Extract deeper ABAP error details if available
							var aDetails = oErr.innererror && oErr.innererror.errordetails;
							if (aDetails && aDetails.length) {
								var sDetail = aDetails.map(function (d) { return d.message; }).join("\n");
								sErrorMsg = sDetail || sErrorMsg;
							}
							console.error("Gate Pass create error:", JSON.stringify(oErr, null, 2));
						} catch (e) { }
						MessageBox.error(sErrorMsg);
					}
				});

			} catch (err) {
				sap.ui.core.BusyIndicator.hide();
				MessageBox.error("Client Error: " + err.message);
			}
		},

		onClear: function () {
			this._resetModel();
		},

		onPrint: async function () {
			var oGp = this.getView().getModel("gp").getData();
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

			var sDate = fnDisplayDate(oGp.gpDate) || new Date().toLocaleDateString('en-GB').split('/').join('-');
			
			// Compute total
			var fTotal = (oGp.items || []).reduce(function (sum, it) {
				return sum + (parseFloat(it.amount) || 0);
			}, 0);

			var sDir = oGp.IsInward ? "INWARD" : "OUTWARD";
			var sType = oGp.IsReturnable ? "RGP" : "NRGP";
			var sTypeLabel = sDir + " " + (oGp.IsReturnable ? "RETURNABLE" : "NON-RETURNABLE") + " GATE PASS";

			// ── PAGE BORDER ──────────────────────────────────────────────────────
			doc.setLineWidth(0.6);
			doc.rect(7, 5, pageWidth - 14, pageHeight - 10);
			doc.setLineWidth(0.2);
			doc.rect(8.5, 6.5, pageWidth - 17, pageHeight - 13);

			// ── HEADER ───────────────────────────────────────────────────────────
			var sLogoUrl = sap.ui.require.toUrl("zaudgpms/audhatham/com/images/audhataam_logo.png");
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
			doc.text("GP No : " + (oGp.GatePassNo || oGp.GatePassReqNo || "Draft"), pageWidth - margin, 12, { align: "right" });
			doc.setFont("helvetica", "normal");
			doc.text("Date : " + sDate, pageWidth - margin, 17, { align: "right" });

			// Thick separator below header
			doc.setLineWidth(0.5);
			doc.line(margin, 30.5, pageWidth - margin, 30.5);

			// ── DOCUMENT TITLE ───────────────────────────────────────────────────
			doc.setFont("helvetica", "bold");
			doc.setFontSize(11);
			doc.text(sTypeLabel, pageWidth / 2, 37, { align: "center" });
			var titleW = doc.getTextWidth(sTypeLabel);
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

			// Left col top row — Please Allow
			doc.setFontSize(8.5);
			doc.setFont("helvetica", "normal");
			doc.text(oGp.IsInward ? "Please receive from:" : "Please allow:", lColX + pad, gridY + 6);
			doc.setFont("helvetica", "bold");
			doc.text(oGp.DriverName || "Mr./Ms.", lColX + 34, gridY + 6);

			// Left col body — Vendor details
			doc.setFontSize(8.5);
			doc.setFont("helvetica", "bold");
			doc.text(oGp.vendorName || "", lColX + pad, gridY + 14);
			doc.setFont("helvetica", "normal");
			var splitAddr = doc.splitTextToSize(oGp.vendorAddress || oGp.vendor || "", lColW - pad * 2 - 2);
			doc.text(splitAddr, lColX + pad, gridY + 19.5);
			doc.setFont("helvetica", "italic");
			doc.setFontSize(8);
			
			var sPremisesAction = oGp.IsInward ? "to bring in the following material to Audhataam premises." : "to take out the following material from Audhataam premises.";
			doc.text(sPremisesAction, lColX + pad, gridY + gridH - 3.5);

			// Right col — Document details
			var rc = rColX + pad, ry = gridY + 6;
			var lblOff = 30;
			doc.setFontSize(8.5);
			doc.setFont("helvetica", "bold"); doc.text("GP Type:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text(sType, rc + lblOff, ry);
			ry += rLH;
			doc.setFont("helvetica", "bold"); doc.text("Department:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text("STORES", rc + lblOff, ry);
			ry += rLH;
			doc.setFont("helvetica", "bold"); doc.text("Vehicle No:", rc, ry);
			doc.setFont("helvetica", "normal"); doc.text(oGp.VehicleNo || "", rc + lblOff, ry);

			// ── ITEMS TABLE ──────────────────────────────────────────────────────
			var tableData = (oGp.items || []).map(function (it, i) {
				return [
					i + 1,
					it.materialName || "",
					it.material || "",
					parseFloat(it.quantity || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
					it.noOfPacks || "",
					it.uom || ""
				];
			});
			while (tableData.length < 6) { tableData.push(["", "", "", "", "", ""]); }

			doc.autoTable({
				startY: gridY + gridH + 1,
				head: [['S.No', 'DESCRIPTION OF GOODS', 'Material Code', 'Quantity', 'No. of Packs', 'UOM']],
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
					2: { cellWidth: 30, halign: 'center' },
					3: { cellWidth: 30, halign: 'right' },
					4: { cellWidth: 50, halign: 'center' },
					5: { cellWidth: 22, halign: 'center' }
				},
				margin: { left: margin, right: margin }
			});

			var finalY = doc.lastAutoTable.finalY;

			// ── REMARKS ROW ──────────────────────────────────────────────────────
			var remY = finalY + 1, remH = 8;
			doc.setLineWidth(0.25);
			doc.rect(margin, remY, contentWidth, remH);
			doc.line(margin + 28, remY, margin + 28, remY + remH);
			doc.setFont("helvetica", "bold"); doc.setFontSize(8);
			doc.text("Remarks:", margin + 3, remY + 5);
			doc.setFont("helvetica", "normal");
			doc.text(doc.splitTextToSize(oGp.Remarks || "NIL", contentWidth - 33), margin + 31, remY + 5);

			// ── SIGNATURE TABLE (grid format) ────────────────────────────────────
			var sigStartY = remY + remH + 6;
			var sigLabels = [
				"Initiator Sign\n& Date",
				"HOD Sign\n& Date",
				"Stores Sign\n& Date",
				"Authorised\nSign",
				"Security Sign\n& Date",
				"Returned On\nDate",
				"Security Sign\n& Date"
			];
			var sigColCount = sigLabels.length;
			var sigColW = contentWidth / sigColCount;
			var sigRowH = 18;

			doc.setLineWidth(0.3);
			doc.rect(margin, sigStartY, contentWidth, sigRowH);
			for (var sc = 1; sc < sigColCount; sc++) {
				doc.line(margin + sigColW * sc, sigStartY, margin + sigColW * sc, sigStartY + sigRowH);
			}
			doc.setFont("helvetica", "bold"); doc.setFontSize(7);
			sigLabels.forEach(function (label, i) {
				var cx = margin + sigColW * i + sigColW / 2;
				var lines = label.split("\n");
				doc.text(lines[0], cx, sigStartY + sigRowH - 5, { align: "center" });
				if (lines[1]) {
					doc.text(lines[1], cx, sigStartY + sigRowH - 1.5, { align: "center" });
				}
			});

			// ── FORMAT NUMBER ─────────────────────────────────────────────────────
			doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
			doc.text("Format No.: HR-013-F001-01-12/05/2025", margin, sigStartY + sigRowH + 5);

			doc.save("GatePass_" + (oGp.GatePassNo || oGp.GatePassReqNo || "Draft") + ".pdf");
			MessageToast.show("Gate Pass PDF generated.");
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
