public class IPT_ProductUpload {
    public IPT_ProductUpload() {

    }
    @AuraEnabled
    public static ProductValidationWrapper checkProductEligibility(
        String productListWithDiscountsJson
    ) 
    {
        List<ProductInputWrapper> productInputs = 
            (List<ProductInputWrapper>) JSON.deserialize(productListWithDiscountsJson, List<ProductInputWrapper>.class);
        
        Set<String> invalidCatNos = new Set<String>();
        Set<String> inactiveCatNos = new Set<String>();
        Set<String> notMappedCatNos = new Set<String>();
        Set<String> alreadyExistingDiscounts = new Set<String>();

        
        Set<String> catNos = new Set<String>();
        for (ProductInputWrapper input : productInputs) {
            system.debug('Processing CAT_No: ' + input.CAT_No);
            if (String.isNotBlank(input.CAT_No)) {
                catNos.add(input.CAT_No);
            }
        }

        if (catNos.isEmpty()) {
            return new ProductValidationWrapper(invalidCatNos, inactiveCatNos, notMappedCatNos, alreadyExistingDiscounts);
        }
        system.debug('Total CAT_Nos to process: ' + catNos.size());
        List<String> catNosList = new List<String>(catNos);
        
        system.debug('CAT_Nos to process: ' + catNosList);
        Map<String, Product_Data__c> productMap = new Map<String, Product_Data__c>(
            [select Name,Id, Capping_Discount__c,  Product_Status__c,Material_Group_SFDC__c from Product_Data__c 
            WHERE Name IN :catNosList]
        );

        system.debug('productMap'+productMap);

        Map<String, Product_Data__c> productMapByCat = new Map<String, Product_Data__c>();
        for (Product_Data__c p : [
            SELECT Name,Id, Capping_Discount__c,  Product_Status__c,Material_Group_SFDC__c from Product_Data__c
            WHERE Name IN :catNosList
        ]) {
            productMapByCat.put(p.Name, p);
        }

        
        for (ProductInputWrapper input : productInputs) {
            if (!productMapByCat.containsKey(input.CAT_No)) {
                system.debug('Invalid CAT_No: ' + input.CAT_No);
                invalidCatNos.add(input.CAT_No);
                continue;
            }
            Product_Data__c prod = productMapByCat.get(input.CAT_No);
            
            if (prod.Product_Status__c == 'Product Discontinued') {
                inactiveCatNos.add(input.CAT_No);
            }
            else if (!isMaterialGroupMapped(prod.Material_Group_SFDC__c, UserInfo.getUserId())) {
                notMappedCatNos.add(input.CAT_No);
            }
            else if (prod.Capping_Discount__c != null) {
                alreadyExistingDiscounts.add(input.CAT_No);
            }
        }

        return new ProductValidationWrapper(invalidCatNos, inactiveCatNos, notMappedCatNos, alreadyExistingDiscounts);
    }

public class ProductInputWrapper {
    @AuraEnabled public String CAT_No {get;set;}
    @AuraEnabled public Decimal Capped_Discount {get;set;}
}

public class ProductValidationWrapper {
    @AuraEnabled public List<String> invalidCatNos {get;set;}
    @AuraEnabled public List<String> inactiveCatNos {get;set;}
    @AuraEnabled public List<String> notMappedCatNos {get;set;}
    @AuraEnabled public List<String> alreadyExistingDiscounts {get;set;}

    public ProductValidationWrapper(
        Set<String> invalid, 
        Set<String> inactive, 
        Set<String> notMapped, 
        Set<String> existing
    ) 
        {
            this.invalidCatNos = new List<String>(invalid);
            this.inactiveCatNos = new List<String>(inactive);
            this.notMappedCatNos = new List<String>(notMapped);
            this.alreadyExistingDiscounts = new List<String>(existing);
        }
    }

    private static Boolean isMaterialGroupMapped(String materialGroup, Id userId) {
        User loggedInUser = [SELECT Id, Material_Group__c FROM User WHERE Id = :userId LIMIT 1];
        if (loggedInUser.Material_Group__c == null) {
            return false;
        }
        List<String> mappedGroup = loggedInUser.Material_Group__c.split(';');
        system.debug('Mapped Material Groups: ' + mappedGroup);
        system.debug('Checking against Material Group: ' + materialGroup);
        for (String mg : mappedGroup) {
            if (mg.trim().equalsIgnoreCase(materialGroup)) {
                return true;
            }
        }
        return false; 
    }

    @AuraEnabled
    public static void updateProducts(List<Map<Object,String>> productUpdates){
        List<Product_Data__c> productsToUpdate = new List<Product_Data__c>();
        List<String> catNos = new List<String>();
        Map<String,Decimal> discountMap = new Map<String,Decimal>();
        for (Map<Object,String> prod: productUpdates) {
            catNos.add(prod.get('CAT_No').toString());
            if (prod.containsKey('Capped_Discount')) {
                Decimal discount = Decimal.valueOf(prod.get('Capped_Discount'));
                discountMap.put(prod.get('CAT_No').toString(), discount);
            }
        }
        productsToUpdate = [SELECT Id, Name, Capping_Discount__c FROM Product_Data__c WHERE Name IN :catNos];
        for (Product_Data__c product : productsToUpdate) {
            if (discountMap.containsKey(product.Name)) {
                product.Capping_Discount__c = discountMap.get(product.Name);
                product.Capping_Created_Date__c = Date.today();
            }
        }
        if (!productsToUpdate.isEmpty()) {
            update productsToUpdate;
        }
    }

}