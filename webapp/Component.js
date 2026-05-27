sap.ui.define([
	"sap/ui/core/UIComponent",
	"./model/models",
	"sap/ui/core/routing/History",
	"sap/ui/Device",
	"sap/ui/model/resource/ResourceModel",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (UIComponent, models, History, Device, ResourceModel, JSONModel, Filter, FilterOperator) {
	"use strict";

	return UIComponent.extend("zaudgpms.audhatham.com.Component", {
		metadata: {
			manifest: "json",
			interfaces: ["sap.ui.core.IAsyncContentCreation"]
		},

		init: function () {
			UIComponent.prototype.init.apply(this, arguments);

			this.setModel(models.createDeviceModel(), "device");

			// Initialize global IRGP collection for mock multi-persona state tracking
			var oIRGPGlobalData = {
				documents: [
					{
						IRGPNo: "IRGP2026-27-0068",
						GEDate: "06-05-2026",
						DueDate: "13-05-2026",
						RevisedDueDate: "13-05-2026",
						ReturnedDate: "01-01-1900",
						Department: "MECHANICAL",
						RequestUser: "Sathish Panchatsaram",
						ReturnUser: "",
						ContractName: "POWER MECH PROJECTS LTD - LHP & AHP",
						ContractEmployeeName: "Sureshbabu",
						RequestType: "HxGN EAM",
						Remarks: "Material issue for Slag path work",
						StatusCode: "PENDING_RESERVATION", // User needs to enter MRN number
						items: [
							{
								SNo: 1,
								ItemCode: "7843200012",
								ItemDescription: "Alloy Steel Plate, Grade: 16MO3, ASTM",
								SentQuantity: "314",
								RecievedQuantity: "0",
								BalanceQuantity: "314",
								UOM: "Kilograms",
								MRNumber: "",
								Location: "NP1",
								Mp2ItemCode: "",
								DefaultBin: "PS - 08"
							}
						]
					},
					{
						IRGPNo: "IRGP2026-27-0045",
						GEDate: "04-05-2026",
						DueDate: "11-05-2026",
						RevisedDueDate: "11-05-2026",
						ReturnedDate: "01-01-1900",
						Department: "ELECTRICAL",
						RequestUser: "Muthuraman A",
						ReturnUser: "",
						ContractName: "POWER MECH PROJECTS LTD - Pressure parts",
						ContractEmployeeName: "SURESH",
						RequestType: "HxGN EAM",
						Remarks: "Emergency issue for cabling",
						StatusCode: "PENDING_RECEIPT", // Ready for store to return counts
						items: [
							{
								SNo: 1,
								ItemCode: "6055850018",
								ItemDescription: "Online AAQMS(Ambient Air Quality Monitoring S:",
								SentQuantity: "2",
								RecievedQuantity: "0",
								BalanceQuantity: "2",
								UOM: "Set",
								MRNumber: "MR-88123",
								Location: "NP1",
								Mp2ItemCode: "",
								DefaultBin: "-"
							}
						]
					}
				]
			};
			var oIRGPGlobalModel = new JSONModel(oIRGPGlobalData);
			this.setModel(oIRGPGlobalModel, "irgpGlobal");

			this._initMockData();
			var oMockODataModel = this._createMockODataModel();
			this.setModel(oMockODataModel);

			this.getRouter().initialize();
			this._authenticateUser();
		},

		myNavBack: function () {
			var oHistory = History.getInstance();
			var oPrevHash = oHistory.getPreviousHash();
			if (oPrevHash !== undefined) {
				window.history.go(-1);
			} else {
				this.getRouter().navTo("masterSettings", {}, true);
			}
		},

		getContentDensityClass: function () {
			if (!this._sContentDensityClass) {
				if (!Device.support.touch) {
					this._sContentDensityClass = "sapUiSizeCompact";
				} else {
					this._sContentDensityClass = "sapUiSizeCozy";
				}
			}
			return this._sContentDensityClass;
		},

		_authenticateUser: function () {
			var oModel = new JSONModel();
			oModel.loadData("/sap/bc/ui2/start_up");
			oModel.attachRequestCompleted(function (oEvent) {
				if (oEvent.getParameter("success")) {
					var oUserData = oEvent.getSource().getData();
					var oUserModel = new JSONModel(oUserData);
					sap.ui.getCore().setModel(oUserModel, "user");
					this.setModel(oUserModel, "user");
					var sUserId = oUserData.id || "";
					this._loadUserDetails(sUserId);
				} else {
					var sHostname = window.location.hostname;
					if (sHostname === "localhost" || sHostname === "127.0.0.1") {
						console.warn("SAP Gateway authentication failed. Falling back to local developer session.");
						var oMockUserData = {
							id: "DEV_USER",
							email: "developer@audhatham.com",
							firstName: "Satya",
							lastName: "Developer",
							fullName: "Satya Developer"
						};
						var oUserModel = new JSONModel(oMockUserData);
						sap.ui.getCore().setModel(oUserModel, "user");
						this.setModel(oUserModel, "user");
						this._loadUserDetails("DEV_USER");
					} else {
						console.warn("SAP authentication failed. Initializing fallback guest session.");
						var oFallbackUserData = {
							id: "GUEST",
							fullName: "Guest User"
						};
						var oUserModel = new JSONModel(oFallbackUserData);
						sap.ui.getCore().setModel(oUserModel, "user");
						this.setModel(oUserModel, "user");
						this._triggerUserUpdateEvent();
					}
				}
			}.bind(this));
		},

		_loadUserDetails: function (sUserId) {
			var oODataModel = this.getModel();
			if (!oODataModel || !sUserId) {
				this._triggerUserUpdateEvent();
				return;
			}

			oODataModel.read("/ZUserdetSet", {
				filters: [new Filter("User", FilterOperator.EQ, sUserId)],
				success: function (oData) {
					var oResult = (oData.results && oData.results[0]) || {};
					console.log("[ZUserdetSet] Plant:", oResult.Plant, "| Cocode:", oResult.Cocode, "| Department:", oResult.Department);
					var oUserModel = sap.ui.getCore().getModel("user");
					if (oUserModel) {
						oUserModel.setProperty("/Plant", oResult.Plant || "");
						oUserModel.setProperty("/Cocode", oResult.Cocode || "");
						oUserModel.setProperty("/Department", oResult.Department || "");
					}
					this._triggerUserUpdateEvent();
				}.bind(this),
				error: function (oError) {
					console.error("[ZUserdetSet] Error:", oError.statusCode, oError.responseText);
					this._triggerUserUpdateEvent();
				}.bind(this)
			});
		},

		_triggerUserUpdateEvent: function () {
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.publish("UserChannel", "UserUpdated");
		},

		_initMockData: function () {
			this._aMockGateReqHdr = [
				{
					GatePassReqNo: "REQ20260001",
					GatePassNo: "GP2026-0001",
					GatePassType: "NRGP",
					Status: "Approved",
					ApprovalReq: "A",
					Cocode: "1000",
					Plant: "2301",
					FiscalYear: "2026",
					GpDate: "20260518",
					Vendor: "VEND001",
					VendorName: "Power Mech Projects Ltd",
					VendorGST: "36AAAAP1234A1Z1",
					ZipCode: "500081",
					City: "Hi-Tech City, Hyderabad",
					Department: "MECHANICAL",
					VehicleNo: "KA-01-ME-1234",
					ModeOfDispatch: "Road",
					Remarks: "Urgent Mechanical Spares",
					HODRemarks: "Approved by HOD",
					STORERemarks: "Verified by Store",
					GateReqItmNav: {
						results: [
							{
								ItemNo: "00010",
								Material: "7843200012",
								MaterialDesc: "Alloy Steel Plate, Grade: 16MO3, ASTM",
								HSNCode: "73089090",
								HSNDesc: "Steel structures",
								UOM: "KG",
								ItemNetPrice: "150.00",
								RequestedQuantity: "120.000",
								Totalvalue: "18000.00",
								Remarks: "For Slag path work"
							}
						]
					}
				},
				{
					GatePassReqNo: "REQ20260002",
					GatePassNo: "GP2026-0002",
					GatePassType: "RGP",
					Status: "Pending",
					ApprovalReq: "P",
					Cocode: "1000",
					Plant: "2301",
					FiscalYear: "2026",
					GpDate: "20260518",
					Vendor: "VEND002",
					VendorName: "Sureshbabu Electricals",
					VendorGST: "36BBBBQ5678B2Z2",
					ZipCode: "500032",
					City: "Madhapur, Hyderabad",
					Department: "ELECTRICAL",
					VehicleNo: "AP-28-EX-5678",
					ModeOfDispatch: "Courier",
					Remarks: "Calibration of Submersible Pump",
					HODRemarks: "",
					STORERemarks: "",
					ReturnableDate: "20260618",
					GateReqItmNav: {
						results: [
							{
								ItemNo: "00010",
								Material: "8002130005",
								MaterialDesc: "Submersible Water Pump 5HP",
								HSNCode: "84137010",
								HSNDesc: "Centrifugal pumps",
								UOM: "SET",
								ItemNetPrice: "3800.00",
								RequestedQuantity: "1.000",
								Totalvalue: "3800.00",
								Remarks: "For repair & calibration"
							}
						]
					}
				}
			];

			this._aMockOutGatePass = [
				{
					GatePassNo: "GP2026-0001",
					GatePassreqNo: "REQ20260001",
					GatePassDate: "20260518",
					GatePassType: "NRGP",
					Plant: "2301",
					Department: "MECHANICAL",
					VendorGST: "36AAAAP1234A1Z1",
					VendorName: "Power Mech Projects Ltd",
					VendorAddress: "Hi-Tech City, Hyderabad",
					City: "Hyderabad",
					VehicleNo: "KA-01-ME-1234",
					GPStatus: "CLOSED",
					FinalTotal: "18000.00",
					OutgateNav: {
						results: [
							{
								ItemNo: "00010",
								Material: "7843200012",
								MaterialDesc: "Alloy Steel Plate, Grade: 16MO3, ASTM",
								HSNCode: "73089090",
								UOM: "KG",
								ItemNetPrice: "150.00",
								SentQuantity: "120.000",
								RecievedQuantity: "120.000",
								BalanceQuantity: "0.000",
								Totalvalue: "18000.00"
							}
						]
					}
				}
			];

			this._aMockPCP = [];
			this._aMockGatePassHDR = [
				{
					GatePassNo: "GP2026-0002",
					GPNo: "GP2026-0002",
					GatePassType: "RGP",
					Plant: "2301",
					Department: "ELECTRICAL",
					Vendor: "VEND002",
					VendorName: "Sureshbabu Electricals",
					VendorGST: "36BBBBQ5678B2Z2",
					Status: "OPEN",
					ReturnableDate: "20260618",
					GatePassItemNav: {
						results: [
							{
								ItemNo: "00010",
								Material: "8002130005",
								Description: "Submersible Water Pump 5HP",
								SentQuantity: "1.000",
								RecievedQuantity: "0.000",
								BalanceQuantity: "1.000",
								UOM: "SET",
								ItemNetPrice: "3800.00",
								Totalvalue: "3800.00",
								GatePassNo: "GP2026-0002",
								GatePassReqNo: "REQ20260002"
							}
						]
					}
				}
			];
		},

		_createMockODataModel: function () {
			var oModel = new JSONModel();
			oModel.metadataLoaded = function () {
				return Promise.resolve();
			};
			oModel.attachMetadataFailed = function () {};
			oModel.detachMetadataFailed = function () {};

			oModel.read = function (sPath, oParams) {
				var success = oParams && oParams.success;
				var error = oParams && oParams.error;
				var filters = oParams && oParams.filters || [];
				var urlParameters = oParams && oParams.urlParameters || {};

				setTimeout(function () {
					// 1. ZUserdetSet
					if (sPath.indexOf("/ZUserdetSet") === 0) {
						var sUserId = "DEV_USER";
						if (filters.length > 0) {
							sUserId = filters[0].getValue1() || filters[0].oValue1 || "DEV_USER";
						}
						success({
							results: [{
								User: sUserId,
								Plant: "2301",
								Cocode: "1000",
								Department: "MECHANICAL"
							}]
						});
						return;
					}

					// 2. ZPlantSet
					if (sPath.indexOf("/ZPlantSet") === 0) {
						success({
							results: [
								{ Plant: "2301", PlantName: "Audhataam Main Plant", CoCode: "1000" },
								{ Plant: "1001", PlantName: "Audhataam Secondary Plant", CoCode: "1000" },
								{ Plant: "3001", PlantName: "Audhataam Logistics Plant", CoCode: "1000" }
							]
						});
						return;
					}

					// 3. ZMaterialSet
					if (sPath.indexOf("/ZMaterialSet") === 0) {
						success({
							results: [
								{ Material: "7843200012", MaterialName: "Alloy Steel Plate, Grade: 16MO3, ASTM", HsnCode: "73089090", HsnDesc: "Steel structures", UOM: "KG", UnitPrice: "150.00" },
								{ Material: "6055850018", MaterialName: "Online AAQMS Ambient Air Quality Monitoring", HsnCode: "90271000", HsnDesc: "Gas analysis apparatus", UOM: "SET", UnitPrice: "4500.00" },
								{ Material: "8002130005", MaterialName: "Submersible Water Pump 5HP", HsnCode: "84137010", HsnDesc: "Centrifugal pumps", UOM: "SET", UnitPrice: "3800.00" },
								{ Material: "5003020001", MaterialName: "Electrical Cable Wire 10m", HsnCode: "85444990", HsnDesc: "Electric conductors", UOM: "M", UnitPrice: "25.00" }
							]
						});
						return;
					}

					// 4. ZVendorSet
					if (sPath.indexOf("/ZVendorSet") === 0) {
						success({
							results: [
								{ Vendor: "VEND001", VendorName: "Power Mech Projects Ltd", Street: "NCC Building, Madhapur", City: "Hyderabad", PostalCode: "500081", Country: "India", VendorGST: "36AAAAP1234A1Z1" },
								{ Vendor: "VEND002", VendorName: "Sureshbabu Electricals", Street: "Plot 42, Gachibowli", City: "Hyderabad", PostalCode: "500032", Country: "India", VendorGST: "36BBBBQ5678B2Z2" }
							]
						});
						return;
					}

					// 5. GateReqHdrSet
					if (sPath.indexOf("/GateReqHdrSet") === 0) {
						var sReqNoFilter = "";
						if (filters.length > 0) {
							filters.forEach(function (f) {
								if (f.getPath() === "GatePassReqNo") {
									sReqNoFilter = f.getValue1() || f.oValue1 || "";
								}
							});
						}

						if (sReqNoFilter) {
							var oMatch = this._aMockGateReqHdr.find(function (item) {
								return item.GatePassReqNo === sReqNoFilter;
							});
							if (oMatch) {
								success({ results: [oMatch] });
							} else {
								success({ results: [this._aMockGateReqHdr[0]] });
							}
						} else {
							var sTypeFilter = "";
							filters.forEach(function (f) {
								if (f.getPath() === "GatePassType") {
									sTypeFilter = f.getValue1() || f.oValue1 || "";
								}
							});

							if (sTypeFilter && sTypeFilter !== "All") {
								var aFiltered = this._aMockGateReqHdr.filter(function (item) {
									return item.GatePassType === sTypeFilter;
								});
								success({ results: aFiltered });
							} else {
								success({ results: this._aMockGateReqHdr });
							}
						}
						return;
					}

					// 6. OutGatePassSet
					if (sPath.indexOf("/OutGatePassSet") === 0) {
						var sTypeFilter = "";
						filters.forEach(function (f) {
							if (f.getPath() === "GatePassType") {
								sTypeFilter = f.getValue1() || f.oValue1 || "";
							}
						});

						if (sTypeFilter) {
							var aFiltered = this._aMockOutGatePass.filter(function (item) {
								return item.GatePassType === sTypeFilter;
							});
							success({ results: aFiltered });
						} else {
							success({ results: this._aMockOutGatePass });
						}
						return;
					}

					// 7. GatePassHDRSet
					if (sPath.indexOf("/GatePassHDRSet") === 0) {
						var sGPNoFilter = "";
						if (filters.length > 0) {
							filters.forEach(function (f) {
								if (f.getPath() === "GatePassNo") {
									sGPNoFilter = f.getValue1() || f.oValue1 || "";
								}
							});
						}

						if (sGPNoFilter) {
							var oMatch = this._aMockGatePassHDR.find(function (item) {
								return item.GPNo === sGPNoFilter || item.GatePassNo === sGPNoFilter;
							});
							if (oMatch) {
								success({ results: [oMatch] });
							} else {
								success({ results: [this._aMockGatePassHDR[0]] });
							}
						} else {
							success({ results: this._aMockGatePassHDR });
						}
						return;
					}

					// 8. GateInPoHdrSet
					if (sPath.indexOf("/GateInPoHdrSet") === 0) {
						var sPO = "";
						var poMatch = sPath.match(/PurchaseOrder='([^']+)'/);
						if (poMatch) {
							sPO = poMatch[1];
						}

						var oPOData = {
							PurchaseOrder: sPO || "4000003222",
							Plant: "2301",
							Vendor: "VEND001",
							VendorDesc: "Power Mech Projects Ltd",
							Department: "MECHANICAL",
							SourceType: "PO",
							DCNumber: "DC12345",
							RRNo: "RR88123",
							InspectionStatus: "Approved",
							Inspectiondate: "2026-05-18",
							Remarks: "Auto-filled PO details",
							GateEntryNo: "GE20269910",
							GEDate: "2026-05-18",
							GateInPoNav: {
								results: [
									{ ItemNo: "10", ItemDescription: "Alloy Steel Plate, Grade: 16MO3, ASTM", POQuantity: "120.000", UOM: "KG", PurchaseOrder: sPO || "4000003222", Plant: "2301", GatePassNo: "", RecievedQuantity: "0.000" }
								]
							}
						};

						if (sPO) {
							success(oPOData);
						} else {
							success({ results: [oPOData] });
						}
						return;
					}

					success({ results: [] });
				}.bind(this), 100);
			}.bind(this);

			oModel.create = function (sPath, oPayload, oParams) {
				var success = oParams && oParams.success;
				var error = oParams && oParams.error;

				setTimeout(function () {
					// 1. GatePassReqHdrSet
					if (sPath.indexOf("/GatePassReqHdrSet") === 0) {
						var sNewReqNo = "REQ" + Math.floor(100000 + Math.random() * 900000);
						var sNewGPNo = "GP2026-" + Math.floor(1000 + Math.random() * 9000);

						var oNewRequest = Object.assign({}, oPayload, {
							GatePassReqNo: sNewReqNo,
							GatePassNo: sNewGPNo,
							Status: "Pending",
							ApprovalReq: "P",
							HODRemarks: "",
							STORERemarks: "",
							GateReqItmNav: {
								results: (oPayload.GateReqItemNav || []).map(function (it) {
									return {
										ItemNo: it.ItemNo,
										Material: it.Material,
										MaterialDesc: it.MaterialDesc,
										HSNCode: it.HSNCode,
										HSNDesc: it.HSNDesc,
										UOM: it.UOM,
										ItemNetPrice: it.ItemNetPrice,
										RequestedQuantity: it.RequestedQuantity,
										Totalvalue: it.Totalvalue,
										Remarks: it.Remarks
									};
								})
							}
						});

						this._aMockGateReqHdr.unshift(oNewRequest);

						if (oPayload.GatePassType === "RGP") {
							this._aMockGatePassHDR.unshift({
								GPNo: sNewGPNo,
								GatePassNo: sNewGPNo,
								GatePassType: "RGP",
								Plant: oPayload.Plant,
								Department: oPayload.Department,
								Vendor: oPayload.Vendor,
								VendorName: oPayload.VendorName,
								VendorGST: oPayload.VendorGST,
								Status: "OPEN",
								ReturnableDate: oPayload.ReturnableDate,
								GatePassItemNav: {
									results: (oPayload.GateReqItemNav || []).map(function (it, idx) {
										return {
											SNo: idx + 1,
											ItemCode: it.Material,
											Description: it.MaterialDesc,
											SentQuantity: it.RequestedQuantity,
											RecievedQuantity: "0.000",
											BalanceQuantity: it.RequestedQuantity,
											UOM: it.UOM,
											ItemNo: it.ItemNo,
											ItemNetPrice: it.ItemNetPrice,
											Totalvalue: it.Totalvalue,
											GatePassNo: sNewGPNo,
											GatePassReqNo: sNewReqNo,
											Remarks: it.Remarks
										};
									})
								}
							});
						}

						success(Object.assign({}, oNewRequest, {
							Message: "Gate Pass Request " + sNewReqNo + " created successfully!"
						}));
						return;
					}

					// 2. OutGatePassSet
					if (sPath.indexOf("/OutGatePassSet") === 0) {
						var sNewGPNo = oPayload.GatePassNo || ("GP2026-" + Math.floor(1000 + Math.random() * 9000));
						var sReqNo = oPayload.GatePassreqNo || "";

						if (sReqNo) {
							var oReq = this._aMockGateReqHdr.find(function (r) {
								return r.GatePassReqNo === sReqNo;
							});
							if (oReq) {
								oReq.Status = "Approved";
								oReq.ApprovalReq = "A";
								oReq.GatePassNo = sNewGPNo;
							}
						}

						var oNewOutGP = Object.assign({}, oPayload, {
							GatePassNo: sNewGPNo,
							GPStatus: "CLOSED",
							OutgateNav: {
								results: (oPayload.OutgateNav || []).map(function (it) {
									return {
										ItemNo: it.ItemNo,
										Material: it.Material,
										HSNCode: it.HSNCode,
										HSNDesc: it.HSNDesc || "",
										UOM: it.UOM,
										ItemNetPrice: it.ItemNetPrice,
										SentQuantity: it.SentQuantity,
										RecievedQuantity: it.SentQuantity,
										BalanceQuantity: "0.000",
										Totalvalue: it.Totalvalue
									};
								})
							}
						});

						this._aMockOutGatePass.unshift(oNewOutGP);

						success(Object.assign({}, oNewOutGP, {
							Message: "Gate Pass " + sNewGPNo + " generated successfully!"
						}));
						return;
					}

					// 3. PCPHdrSet
					if (sPath.indexOf("/PCPHdrSet") === 0) {
						var sNewPCPNo = "PCP2026" + Math.floor(1000 + Math.random() * 9000);
						var oNewPCP = Object.assign({}, oPayload, {
							PCPNo: sNewPCPNo,
							Message: "Petty Cash Purchase " + sNewPCPNo + " created successfully!"
						});

						this._aMockPCP.unshift(oNewPCP);

						var sNewGPNo = "GP2026-" + Math.floor(1000 + Math.random() * 9000);
						this._aMockGateReqHdr.unshift({
							GatePassReqNo: "",
							GatePassNo: sNewGPNo,
							GatePassType: "PO",
							Status: "Approved",
							Plant: oPayload.Plant,
							VendorName: oPayload.VendorDesc || oPayload.VendorName || "Petty Cash Vendor",
							Department: oPayload.Department,
							VehicleNo: oPayload.DCNumber || "",
							ApprovalReq: "A"
						});

						success(oNewPCP);
						return;
					}

					// 4. GateRetHdrSet
					if (sPath.indexOf("/GateRetHdrSet") === 0) {
						var sGPNo = oPayload.GatePassNo || "";

						var oMatch = this._aMockGatePassHDR.find(function (item) {
							return item.GPNo === sGPNo || item.GatePassNo === sGPNo;
						});
						if (oMatch) {
							oMatch.Status = "CLOSED";
							if (oMatch.GatePassItemNav && oMatch.GatePassItemNav.results) {
								oMatch.GatePassItemNav.results.forEach(function (it) {
									var payItm = (oPayload.GateRetItmNav || []).find(function (pi) {
										return pi.ItemNo === it.ItemNo;
									});
									if (payItm) {
										it.RecievedQuantity = String(parseFloat(it.RecievedQuantity || 0) + parseFloat(payItm.RecievedQuantity));
										it.BalanceQuantity = String(parseFloat(it.BalanceQuantity) - parseFloat(payItm.RecievedQuantity));
									}
								});
							}
						}

						success({
							Message: "Inward Gate Pass for " + sGPNo + " posted successfully!"
						});
						return;
					}

					success({ Message: "Success" });
				}.bind(this), 100);
			}.bind(this);

			return oModel;
		}
	});
});