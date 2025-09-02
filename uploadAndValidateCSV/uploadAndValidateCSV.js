import { LightningElement,wire,track,api } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import productSelectionTemplate from '@salesforce/resourceUrl/DMS_SampleProductSelection';
import checkProductEligibility from '@salesforce/apex/IPT_ProductUpload.checkProductEligibility';
import updateProducts from '@salesforce/apex/IPT_ProductUpload.updateProducts';

export default class iptUploadProduct extends NavigationMixin(LightningElement) {

    ///product selection csv
    @track uploadProduct= false
    @track ProductFile;
    @track ProductLstDocName;
    @track ProductContentVersionId;
    @track results = [];

    @track wrongProductList = [];
    @track totalProducts = 0;
    @track invalidProductNumber = 0;
    @track validProductNumber = 0;
    @track openProductViewModal = false;
    @track ValidNames2 = [];
    @track allProduct = [];
    @track validProducts = [];
    @track productBOQWrapper;
    @track eligibleProductList = [];
    @track discontinuedProductList = [];
    @track nonSalesOrgProductList = [];
    @track nullSalesOrgProductList = [];
    @track unavailableProductList = [];
    @track invalidPricebookEntryList = [];

    downloadTemplate(){
        window.open(productSelectionTemplate,'_blank');
    };

    uploadTemplate(){
        this.uploadProduct = true;
    
    };

     handleCancelProduct(){
        this.uploadProduct = false;
        this.ProductLstDocName = '';
        this.ProductFile = undefined;
        console.log('file',this.ProductFile);
        this.ProductContentVersionId = '';
        this.WrongProd = 0;
        this.wrongProductList = [];
    };

    handleProductUpload(event){
        const files = event.detail.files;
        this.ProductFile = files[0];
        console.log('file',this.ProductFile);
        this.ProductLstDocName = event.target.files[0].name;
        this.ProductContentVersionId = event.target.files[0].contentVersionId;
        
    
    };

    readProduct(){
        if (this.ProductFile) {
            this.read(this.ProductFile);
            
        } else {
            this.showToastMessage('Error', 'Please upload Product file', 'error');
        }
    }

    async read(file) {
        try {
            const result = await this.load(file);
    
            this.parseCSV(result);
        } catch (e) {
            this.error = e;
        }
    }

    async load(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
    
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = () => {
    
                reject(reader.error);
            };
    
            reader.readAsText(file);
        });
    }

    parseCSV(csv) {
        const lines = csv.split(/\r\n|\n/);
        const headers = lines[0].split(',');
        
        const data = [];
        lines.forEach((line, i) => {
            if (i === 0 || !line.trim()) return;
            
            const obj = {};
            const currentline = line.split(',');
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j].trim()] = currentline[j]?.trim();
            }
            data.push(obj);
        });

        this.ProductData = data.map(item => ({
            CAT_No: item['CAT No']?.toUpperCase(),
            Capped_Discount: item['Capping Discount']
        }));
        console.log("Parsed Product Data:", this.ProductData);
        this.totalProducts = this.ProductData.length;
        if(this.totalProducts == 0 ) {
            this.showToastMessage('Error', 'No valid Product records found in the file', 'error');
            return;
        }

        
        this.validateProducts();
    }

    validateProducts() {
        let validationResults = [];
        let seenCatNos = new Set();

        this.ProductData.forEach((item, idx) => {
            let errors = [];
            console.log("Validating item:", item);
            
            if (!item.CAT_No) {
                errors.push("CAT Number is missing");
            }
            if (!item.Capped_Discount || isNaN(item.Capped_Discount)) {
                errors.push("Capping Discount must be a valid numeric value");
            } else if (parseFloat(item.Capped_Discount) > 40) {
                errors.push("Capping Discount cannot exceed 40%");
            }

            if (seenCatNos.has(item.CAT_No)) {
                errors.push("Duplicate CAT Number in upload file");
            }
            seenCatNos.add(item.CAT_No);

            validationResults.push({
                ...item,
                rowNumber: idx + 1,
                errors
            });
        });
        // console.log("Validation Results:", validationResults);
        // console.log('JSON.stringify(this.ProductData.map(x => x.CAT_No)):', JSON.stringify(this.ProductData.map(x => x.CAT_No)));
        
    checkProductEligibility({
            
            productListWithDiscountsJson: JSON.stringify(this.ProductData)
        })
        .then(result => {
            validationResults = validationResults.map(row => {
                let errors = [...row.errors];
                
                if (result.invalidCatNos.includes(row.CAT_No)) {
                    errors.push("Invalid CAT Number");
                }
                if (result.inactiveCatNos.includes(row.CAT_No)) {
                    errors.push("CAT Number is inactive");
                }
                if (result.notMappedCatNos.includes(row.CAT_No)) {
                    errors.push("Material Group is not mapped to user");
                }
                if (result.alreadyExistingDiscounts.includes(row.CAT_No)) {
                    errors.push("Capping Discount for this CAT Number already exists");
                }

                return { ...row, errors };
            });
            console.log("Validation Results:", JSON.stringify(validationResults,null,2));
            this.results = validationResults;
            this.showValidationSummary(validationResults);

        })
        .catch(error => {
            console.error("Validation Error:", error);
        });
    }

    showValidationSummary(validationResults) {
        this.validationResults = validationResults;
        this.passCount = validationResults.filter(v => v.errors.length === 0).length;
        this.failCount = validationResults.filter(v => v.errors.length > 0).length;
        this.validProducts = validationResults.filter(v => v.errors.length === 0);
        console.log("validProducts:", JSON.stringify(this.validProducts));
        this.openProductViewModal = true;  
        this.uploadProduct = false;
    }

        
    handleExportCSV() {
        try{
            if (!this.results || this.results.length === 0) {
                return;
            }

            // Define headers
            const headers = [ "CAT_No", "Capped_Discount", "Result", "Errors"];

            // Build rows
            const rows = this.results.map(r => {
                return [
                    r.CAT_No || "",
                    r.Capped_Discount || "",
                    r.errors.length === 0 ? "Pass" : "Fail",
                    r.errors.join(" | ")
                ];
            });

            // Convert to CSV string
            const csvContent = [
                headers.join(","),
                ...rows.map(row => row.map(value => `"${value}"`).join(","))
            ].join("\n");

            // Encode as data URI instead of Blob
            const csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);

            const link = document.createElement("a");
            link.setAttribute("href", csvData);
            link.setAttribute("download", "validation_report.csv");
            link.style.display = "none";

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        catch (error) {
            console.error("Error exporting CSV:", error);
            this.showToastMessage('Error', 'Failed to export CSV', 'error');
        }
    }
    
        /*handleCancelProductModal(){
            this.openProductViewModal = false;
            this.validProducts = [];
        }*/
    
        handleCancelProductModal() {
            console.log('entered cancel modal');
            this.ProductFile = undefined;
            this.ProductLstDocName = '';
            this.ProductContentVersionId = '';
            this.openProductViewModal = false;
        }

        handleProceedValid(){
            // this.openProductViewModal = false;
            // this.uploadProduct = false;
            // this.ProductFile = undefined;
            // this.ProductLstDocName = '';
            // this.ProductContentVersionId = '';
            const cleanProducts = this.validProducts.map(v => {
                return {
                    CAT_No: v.CAT_No,
                    Capped_Discount: v.Capped_Discount,
                };
            });

            
            updateProducts({ productUpdates: cleanProducts })
            .then(result => {
                console.log('result:', result);
                this.showToastMessage('Success', 'Products updated successfully', 'success');
                this.validProducts = [];
                this.passCount = 0;
                this.failCount = 0;
                this.uploadProduct = false;
                this.ProductFile = undefined;
                this.ProductLstDocName = '';
                this.ProductContentVersionId = '';
                window.location.reload(); // Reload the page to reflect changes
            })
            .catch(error => {
                console.error('Error updating products:', error);
                this.showToastMessage('Error', 'Failed to update products', 'error');
            }
            );
        }

        showToastMessage(title, message, variant) {
            const evt = new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            });
            this.dispatchEvent(evt);
        }

        handleReUpload(){
            this.uploadProduct = true;
            this.openProductViewModal = false;
            this.ProductFile = undefined;
            this.ProductLstDocName = '';
            this.ProductContentVersionId = '';
            this.validProducts = [];
            this.passCount = 0;
            this.failCount = 0;
            this.totalProducts = 0;
        }

        get passProducts() {
            return this.passCount == 0 || this.passCount == undefined ? false : true;
        }

        get failedProducts() {
            return this.failCount ==0 || this.failCount == undefined ? false : true;
        }
}